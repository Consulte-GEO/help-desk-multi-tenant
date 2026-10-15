#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera o modelo padrão de implantação R02 · v5.22.47

Saída: frontend/public/modelos/Modelo-Implantacao-Consulte-GEO-R02.xlsx

Por que um modelo novo (R02) em vez do R00/R01:
  - o modelo antigo não tinha Projetista nem concreto aplicado por
    unidade/peça (pedido direto do produto);
  - o layout antigo usava seções em duas colunas lado a lado na aba
    Estrutura — difícil de preencher e de importar; o R02 é 100%%
    tabular (1 linha = 1 registro), com dropdowns nos campos de
    vocabulário fechado;
  - as abas espelham as etapas do wizard, então a importação preenche
    o cadastro inteiro (Obra, Estruturas, Peças, Concretos, Usuários,
    Fornecedores).

Regra de compatibilidade com o importador
(frontend/public/assets/implantacao-import-core.js):
  - abas de dados começam com o CABEÇALHO NA LINHA 1 (sem linha de
    título mesclada acima — título mesclado expandido venceria a
    detecção de cabeçalho, bug conhecido do motor de Pré-análise);
  - nomes de coluna casam por prefixo normalizado (sem acento,
    minúsculas) com os candidatos do core.

Uso:  python3 tools/gerar-modelo-implantacao-r02.py
Determinístico: mesmo input → mesmo arquivo (sem timestamps).
"""

import os

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.workbook.defined_name import DefinedName

# ── Design System Consulte GEO ────────────────────────────────────────────
NAVY = "FF182863"        # --brand-navy
NAVY_DEEP = "FF0E1B40"   # --brand-navy-deep
MAGENTA = "FFC5117E"     # --brand-magenta
GRAY_LIGHT = "FFF1F3F9"  # zebra clara
GRAY_LINE = "FFD5DAE6"
WHITE = "FFFFFFFF"

F_TITLE = Font(name="Calibri", size=14, bold=True, color=WHITE)
F_HEADER = Font(name="Calibri", size=11, bold=True, color=WHITE)
F_LABEL = Font(name="Calibri", size=11, bold=True, color="FF182863")
F_BODY = Font(name="Calibri", size=11, color="FF1F2430")
F_HINT = Font(name="Calibri", size=10, italic=True, color="FF5A6478")

FILL_TITLE = PatternFill("solid", fgColor=NAVY_DEEP)
FILL_HEADER = PatternFill("solid", fgColor=NAVY)
FILL_LABEL = PatternFill("solid", fgColor=GRAY_LIGHT)

THIN = Side(style="thin", color=GRAY_LINE)
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center")

N_ROWS = 200            # linhas pré-formatadas/validadas nas abas tabulares
N_CONCRETOS = 40        # linhas da lista de concretos (defined name p/ dropdown)
N_ESTRUTURAS_REF = 40   # linhas da lista de estruturas (defined name p/ dropdown)

# Vocabulários — EXATAMENTE os do wizard (setup.models.ts)
TIPOS_ESTRUTURA = ["Bloco", "Torre", "Contenção", "Área Externa", "Anexos", "Apoio"]
ETAPAS = ["Fundação", "Infraestrutura", "Contenção", "Anexos", "Estrutura"]
PERFIS = ["Operador de Campo", "Engenheiro", "Qualidade", "Laboratório", "Analista / Gestor"]
TIPOS_FORNECEDOR = ["Usina", "Laboratório"]


def sheet_titulo(ws, texto, ncols):
    """Linha de título APENAS em abas rótulo/valor (Obra) e Instruções.
    Abas tabulares NÃO recebem título (cabeçalho precisa ser a linha 1)."""
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncols)
    c = ws.cell(row=1, column=1, value=texto)
    c.font = F_TITLE
    c.fill = FILL_TITLE
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 28


def cabecalho_tabular(ws, headers, widths, comments=None):
    """Cabeçalho estilizado na LINHA 1 + zebra + bordas nas N_ROWS seguintes."""
    for i, (h, w) in enumerate(zip(headers, widths), start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = F_HEADER
        c.fill = FILL_HEADER
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDER
        ws.column_dimensions[get_column_letter(i)].width = w
        if comments and comments.get(h):
            cm = Comment(comments[h], "Consulte GEO")
            cm.width, cm.height = 260, 120
            c.comment = cm
    ws.row_dimensions[1].height = 30
    for r in range(2, N_ROWS + 2):
        for i in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=i)
            cell.border = BORDER
            cell.font = F_BODY
            if r % 2 == 0:
                cell.fill = PatternFill("solid", fgColor=GRAY_LIGHT)
    ws.freeze_panes = "A2"


def dv_lista(ws, valores, col_letter, allow_blank=True):
    """Dropdown de lista fixa aplicado às N_ROWS linhas de dados."""
    dv = DataValidation(
        type="list",
        formula1='"' + ",".join(valores) + '"',
        allow_blank=allow_blank,
        showErrorMessage=True,
        errorTitle="Valor fora da lista",
        error="Escolha um dos valores do dropdown.",
    )
    ws.add_data_validation(dv)
    dv.add(f"{col_letter}2:{col_letter}{N_ROWS + 1}")
    return dv


def main():
    wb = Workbook()

    # ══ 1. Instruções ═════════════════════════════════════════════════════
    ws = wb.active
    ws.title = "Instruções"
    ws.sheet_view.showGridLines = False
    sheet_titulo(ws, "Implantação de Obra · Consulte GEO Concreto — Modelo R02", 2)
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 105

    linhas = [
        ("", ""),
        ("Como usar", "Preencha as abas na ordem. Campos com * são obrigatórios. "
                      "Ao terminar, importe este arquivo na tela de Implantação "
                      "(setup.consultegeo.org, Etapa 1 → Importar planilha preenchida) — "
                      "o cadastro inteiro é montado e você só revisa."),
        ("", ""),
        ("Aba Obra", "Dados de identificação da obra: um rótulo por linha, valor na coluna ao lado."),
        ("Aba Estruturas", "Uma linha por estrutura (torre, bloco, contenção…). "
                           "Tipo de Estrutura tem dropdown. Número aceita intervalo (\"1 a 5\"), "
                           "lista (\"1, 2 e 9\") ou \"-\" para estrutura única sem numeração. "
                           "Projetista é OPCIONAL — deixe em branco se ainda não souber."),
        ("Aba Concretos", "Um traço por linha: descrição completa (ex.: FCK 30 | Bombeável - Slump 120±20mm), "
                          "aplicação e padrão de moldagem dos ensaios."),
        ("Aba Peças", "Uma linha por peça/pavimento. Na coluna Estrutura use o dropdown (traz a "
                      "Nomenclatura da aba Estruturas) ou digite o Número. \"Concreto aplicado\" tem "
                      "dropdown com as descrições da aba Concretos. Volume em m³ com até 2 casas decimais."),
        ("Aba Usuários", "Quem terá acesso ao sistema. Perfil de acesso tem dropdown."),
        ("Aba Fornecedores", "Usinas concreteiras e laboratórios. Tipo tem dropdown. "
                             "Até 3 emails de programação, separados por ponto e vírgula (;)."),
        ("", ""),
        ("Exemplos de preenchimento", ""),
        ("Estruturas", "Torre | 1 a 5 | Torres 1 a 5 | (Projetista em branco) | —"),
        ("Estruturas", "Área Externa | - | Área Externa | Empresa de Projetos XYZ | muros e passeio"),
        ("Peças", "1 a 5 | Pavimento Tipo | Estrutura | FCK 30 | 98,31 | FCK 30 | Bombeável - Slump 120±20mm"),
        ("Peças", "1 a 5 | Estacas | Fundação | FCK 25 | 12,50 | (dropdown da aba Concretos)"),
        ("", ""),
        ("Compatibilidade", "A tela de Implantação também importa o modelo antigo (R00/R01), "
                            "mas ele não tem Projetista nem concreto por peça — prefira este modelo."),
        ("Dúvidas", "suporte@consultegeo.com.br"),
    ]
    r = 2
    for rotulo, texto in linhas:
        if rotulo:
            c = ws.cell(row=r, column=1, value=rotulo)
            c.font = F_LABEL
            c.alignment = WRAP
        if texto:
            c = ws.cell(row=r, column=2, value=texto)
            c.font = F_BODY if rotulo not in ("Estruturas", "Peças") else F_HINT
            c.alignment = WRAP
        r += 1

    # ══ 2. Obra (rótulo/valor) ════════════════════════════════════════════
    ws = wb.create_sheet("Obra")
    ws.sheet_view.showGridLines = False
    sheet_titulo(ws, "Dados da Obra", 2)
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 60

    campos_obra = [
        ("Empresa / Contratante *", "Construtora ou incorporadora responsável."),
        ("CNPJ", ""),
        ("Nome da Obra *", "Nome pelo qual a equipe chama a obra."),
        ("Endereço completo *", "Rua, número, bairro."),
        ("CEP", ""),
        ("Cidade / Regional", ""),
        ("Quantidade de blocos/torres", ""),
        ("Número de unidades", ""),
        ("Engenheiro da obra", ""),
    ]
    r = 3
    for rotulo, dica in campos_obra:
        c = ws.cell(row=r, column=1, value=rotulo)
        c.font = F_LABEL
        c.fill = FILL_LABEL
        c.border = BORDER
        c.alignment = Alignment(vertical="center", indent=1)
        v = ws.cell(row=r, column=2)
        v.border = BORDER
        v.font = F_BODY
        if dica:
            cm = Comment(dica, "Consulte GEO")
            cm.width, cm.height = 240, 80
            c.comment = cm
        ws.row_dimensions[r].height = 22
        r += 1

    # ══ 3. Estruturas ═════════════════════════════════════════════════════
    ws = wb.create_sheet("Estruturas")
    cabecalho_tabular(
        ws,
        ["Tipo de Estrutura *", "Número da Estrutura *", "Nomenclatura no Sistema",
         "Projetista (opcional)", "Observações"],
        [20, 22, 30, 28, 40],
        comments={
            "Tipo de Estrutura *": "Escolha no dropdown: " + ", ".join(TIPOS_ESTRUTURA) + ".",
            "Número da Estrutura *": 'Aceita intervalo ("1 a 5"), lista ("1, 2 e 9") '
                                     'ou "-" para estrutura única sem numeração.',
            "Nomenclatura no Sistema": "Como a estrutura deve aparecer no sistema. "
                                       "Se vazio, usamos o Tipo + Número.",
            "Projetista (opcional)": "Texto livre. Pode ficar em branco — não bloqueia a importação.",
        },
    )
    dv_lista(ws, TIPOS_ESTRUTURA, "A")
    # Nomenclatura (col. C) alimenta o dropdown "Estrutura" da aba Peças —
    # é a chave de ligação entre as duas abas. Ver nota em N_ESTRUTURAS_REF.
    wb.defined_names.add(
        DefinedName("ListaEstruturas", attr_text=f"Estruturas!$C$2:$C${N_ESTRUTURAS_REF + 1}")
    )

    # ══ 4. Concretos ══════════════════════════════════════════════════════
    ws = wb.create_sheet("Concretos")
    cabecalho_tabular(
        ws,
        ["Concreto Padrão (descrição completa) *", "Aplicação *", "FCK (MPa)",
         "Padrão de Moldagem dos Ensaios"],
        [46, 34, 12, 42],
        comments={
            "Concreto Padrão (descrição completa) *":
                "Ex.: FCK 30 | Bombeável - Slump 120±20mm. Esta descrição alimenta o "
                "dropdown \"Concreto aplicado\" da aba Peças.",
            "FCK (MPa)": "Somente o número (ex.: 30). Se vazio, extraímos da descrição.",
            "Padrão de Moldagem dos Ensaios":
                "Ex.: 1 CP - 7 dias / 2 CPs - 28 dias / 1 CP - 63 dias.",
        },
    )
    # defined name p/ dropdown das Peças
    ref = f"Concretos!$A$2:$A${N_CONCRETOS + 1}"
    wb.defined_names.add(DefinedName("ListaConcretos", attr_text=ref))

    # ══ 5. Peças ══════════════════════════════════════════════════════════
    ws = wb.create_sheet("Peças")
    cabecalho_tabular(
        ws,
        ["Estrutura *", "Peça/Pavimento *", "Etapa", "FCK de Projeto *",
         "Volume por unidade (m³)", "Concreto aplicado", "Observações"],
        [22, 26, 16, 14, 18, 46, 32],
        comments={
            "Estrutura *": "Use o dropdown (traz a Nomenclatura da aba Estruturas) — ou digite o "
                           "Número da Estrutura. Todas as peças com o mesmo valor entram na mesma "
                           "estrutura. Se você escrever só o tipo (ex.: \"Contenção\") e existir "
                           "uma única estrutura daquele tipo, a importação associa e avisa.",
            "Peça/Pavimento *": "Ex.: Pavimento Tipo, Estacas, Bloco de Coroamento, Muro de Arrimo.",
            "Etapa": "Dropdown: " + ", ".join(ETAPAS) + ". Se vazio, classificamos pelo nome da peça.",
            "FCK de Projeto *": 'Aceita "30", "FCK 30", "30 MPa".',
            "Volume por unidade (m³)": "Número com até 2 casas decimais (ex.: 98,31). "
                                       "Mais casas são arredondadas na importação, com aviso.",
            "Concreto aplicado": "Dropdown com as descrições da aba Concretos. "
                                 "Novidade do R02 — o modelo antigo não tinha concreto por peça.",
        },
    )
    dv_lista(ws, ETAPAS, "C")
    # Dropdowns por defined name. showErrorMessage=False de propósito nos dois:
    # são SUGESTÃO, não trava — o cliente ainda pode digitar um número de
    # estrutura ("1 a 5") ou um traço que só criará depois. O que não casar
    # vira aviso na importação, nunca dado perdido em silêncio.
    dv_estrut = DataValidation(
        type="list", formula1="=ListaEstruturas", allow_blank=True,
        showErrorMessage=False,
    )
    ws.add_data_validation(dv_estrut)
    dv_estrut.add(f"A2:A{N_ROWS + 1}")
    dv_conc = DataValidation(
        type="list", formula1="=ListaConcretos", allow_blank=True,
        showErrorMessage=False,
    )
    ws.add_data_validation(dv_conc)
    dv_conc.add(f"F2:F{N_ROWS + 1}")

    # ══ 6. Usuários ═══════════════════════════════════════════════════════
    ws = wb.create_sheet("Usuários")
    cabecalho_tabular(
        ws,
        ["Nome *", "Email *", "Cargo", "Telefone", "Perfil de acesso"],
        [30, 34, 22, 18, 22],
        comments={
            "Perfil de acesso": "Dropdown: " + ", ".join(PERFIS) + ".",
        },
    )
    dv_lista(ws, PERFIS, "E")

    # ══ 7. Fornecedores ═══════════════════════════════════════════════════
    ws = wb.create_sheet("Fornecedores")
    cabecalho_tabular(
        ws,
        ["Tipo *", "Nome *", "CNPJ", "Endereço", "Responsável",
         "Emails de programação (até 3, separados por ;)", "Telefone", "Observações"],
        [14, 32, 20, 36, 24, 40, 18, 28],
        comments={
            "Tipo *": "Usina (concreteira) ou Laboratório (ensaios).",
            "Emails de programação (até 3, separados por ;)":
                "Ex.: tecnico@usina.com.br; comercial@usina.com.br",
        },
    )
    dv_lista(ws, TIPOS_FORNECEDOR, "A")

    # ── grava ─────────────────────────────────────────────────────────────
    out_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "modelos")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "Modelo-Implantacao-Consulte-GEO-R02.xlsx")
    wb.save(out)
    print(f"OK  {os.path.relpath(out)}  ({os.path.getsize(out)} bytes)")


if __name__ == "__main__":
    main()
