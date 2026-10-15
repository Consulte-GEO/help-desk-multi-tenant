#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validação browser V10 (v5.22.47) — roda contra vite preview :4173.

Verifica no browser real:
  1. Etapa 1 SEM o switch de modelos (nada de "Modelo Simplificado" /
     "Modelo Completo com Projetista" na interface);
  2. card "Importar planilha de implantação" presente com link do R02;
  3. topbar com UM botão de exemplo;
  4. importação end-to-end da planilha REAL preenchida (modelo antigo):
     service → script injection do XLSX vendor + core → parse → commit
     applyImportedData → resumo na tela;
  5. Etapa 2 com "(opcional)" no cabeçalho Projetista + grupos importados;
  6. Etapas 3/5/6 com concretos/usuários/fornecedores importados;
  7. zero erros de console.

Uso: python3 tools/browser-validate-v10.py [caminho-planilha-preenchida]
"""
import re
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
PLANILHA = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/modelo-preenchido.xlsx"

ok_list, fail_list = [], []


def check(nome, cond, info=""):
    (ok_list if cond else fail_list).append((nome, info))
    print(("OK    " if cond else "FALHA ") + nome + ((" → " + info) if info else ""))


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    console_errors = []
    failed_requests = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))
    page.on("requestfailed", lambda r: failed_requests.append(r.url))

    page.goto(BASE + "/", wait_until="networkidle")
    time.sleep(1)

    body = page.inner_text("body")
    check("Etapa 1 sem citação de modelos", "Modelo Simplificado" not in body and "Modelo de preenchimento" not in body)
    check("Card de importação visível", page.locator('[data-testid="import-planilha-card"]').count() == 1)
    href = page.locator('a[download="Modelo-Implantacao-Consulte-GEO-R02.xlsx"]').get_attribute("href")
    check("Link do modelo R02", href is not None and "modelos/Modelo-Implantacao-Consulte-GEO-R02.xlsx" in (href or ""), str(href))
    exemplos = page.locator(".actions-cluster--utility .btn.brand").all_inner_texts()
    check("Topbar com 1 botão de exemplo", len(exemplos) == 1 and "exemplo" in exemplos[0].lower(), " | ".join(exemplos))
    check("Campos do modelo completo sempre visíveis", page.locator("#modeloProjetoFields").count() == 1)

    # 4) importação end-to-end com a planilha REAL (modelo antigo)
    page.set_input_files('[data-testid="import-planilha-card"] input[type=file]', PLANILHA)
    page.wait_for_selector('[data-testid="import-resumo"]', timeout=20000)
    resumo = page.locator('[data-testid="import-resumo"]').inner_text()
    check("Resumo de importação exibido", "estrutura" in resumo.lower(), resumo.replace("\n", " ")[:140])

    # Números ESPERADOS vêm do próprio resumo — o teste vale para qualquer
    # planilha (modelo novo R02 ou legado), em vez de limiares fixos.
    def n_de(rotulo):
        m = re.search(r"(\d+)\s+" + rotulo, resumo)
        return int(m.group(1)) if m else -1

    esp_estruturas, esp_pecas = n_de("estrutura"), n_de("peça")
    esp_usuarios, esp_forn = n_de("usuário"), n_de("fornecedor")
    check("Resumo tem contagens legíveis",
          min(esp_estruturas, esp_pecas, esp_usuarios, esp_forn) >= 0,
          f"{esp_estruturas} estr / {esp_pecas} peças / {esp_usuarios} usu / {esp_forn} forn")
    page.screenshot(path="/tmp/v10-step1-importado.png", full_page=True)

    # nome da obra preenchido pela importação
    obra_nome = page.locator("#obraNome").input_value()
    check("Obra preenchida pela importação", len(obra_nome) > 3, obra_nome)

    # 5) Etapa 2 — projetista opcional + grupos importados
    page.locator(".step-link").filter(has_text="Blocos e torres").first.click()
    time.sleep(0.8)
    ths = page.locator("table thead th").all_inner_texts()
    # th é uppercased por CSS (text-transform) — comparação case-insensitive
    check("Cabeçalho Projetista (opcional)", any("projetista" in t.lower() and "opcional" in t.lower() for t in ths), " | ".join(ths))
    check("Descrição diz que Projetista é opcional", "Projetista é opcional" in page.inner_text("body"))
    linhas = page.locator("table tbody tr").count()
    check("Estruturas importadas na Etapa 2 batem com o resumo",
          linhas == esp_estruturas, f"{linhas} linhas na tela vs {esp_estruturas} no resumo")
    page.screenshot(path="/tmp/v10-step2-estruturas.png", full_page=True)

    # 6) Etapas seguintes — concretos, usuários, fornecedores
    page.locator(".step-link").filter(has_text="Concretos").first.click()
    time.sleep(0.6)
    check("Concretos importados", "FCK 30" in page.inner_text("body"))
    page.locator(".step-link").filter(has_text="Usuários da obra").first.click()
    time.sleep(0.6)
    # emails ficam em <input> — inner_text não os captura; conta pelos values
    emails_preenchidos = page.locator("input").evaluate_all(
        "els => els.filter(e => (e.value || '').includes('@')).length"
    )
    check("Usuários importados batem com o resumo",
          emails_preenchidos == esp_usuarios,
          f"{emails_preenchidos} emails na tela vs {esp_usuarios} no resumo")
    page.locator(".step-link").filter(has_text="Fornecedores").first.click()
    time.sleep(0.6)
    check("Fornecedores importados", "usina" in page.inner_text("body").lower())
    page.screenshot(path="/tmp/v10-step6-fornecedores.png", full_page=True)

    # 7) console limpo — ignora falhas de REDE EXTERNA (sandbox sem saída
    # p/ Supabase/fontes); só reprova erro de página/JS ou recurso local
    externos = [u for u in failed_requests if "localhost" not in u]
    locais = [u for u in failed_requests if "localhost" in u and "favicon" not in u]
    reais = [e for e in console_errors if "failed to load resource" not in e.lower() and "favicon" not in e.lower()]
    check("Zero erros de JS/página", len(reais) == 0, "; ".join(reais[:3]))
    check("Zero recursos LOCAIS falhando", len(locais) == 0, "; ".join(locais[:3]))
    if externos:
        print(f"      (info: {len(externos)} request(s) externo(s) bloqueado(s) pelo sandbox — esperado: " + "; ".join(sorted(set(externos))[:2]) + ")")

    browser.close()

print(f"\n{len(ok_list)} OK, {len(fail_list)} FALHA")
sys.exit(1 if fail_list else 0)
