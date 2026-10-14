import {formatPortalInstant} from './portal-format.js';
import {node,prepareRoot,counters,stateCard,metricText} from './portal-ui.js';
const labels={firstHumanResponse:'Primeira resposta humana',solutionTime:'Tempo de solução',overdue:'Atrasados',csat:'Satisfação do atendimento',knowledge:'Conhecimento',development:'Correção no desenvolvimento'};
/** Only server totals and allowlisted metrics. No inferred sample, trend, SLA or zero placeholder. */
export function renderOperationalReport(root,report){
 prepareRoot(root,'hd-portal hd-operational-report');root.replaceChildren();
 const header=node(root,'header',undefined,'hd-portal-header');header.append(node(root,'p','ATENDIMENTO · INDICADORES','hd-portal-eyebrow'),node(root,'h2','Relatório operacional'));root.append(header);
 if(!report){root.append(stateCard(root,'Relatório indisponível','Consulte novamente pelos controles da página. Valores ausentes não foram substituídos por zero.'));return;}
 header.append(node(root,'p','Consulta: '+formatPortalInstant(report.asOf),'hd-portal-muted'));
 root.append(counters(root,report,'Aguardando cliente'));
 const panel=node(root,'section',undefined,'hd-portal-list-panel');panel.append(node(root,'h3','Indicadores de atendimento'),node(root,'p','Valores retornados pelo servidor. Indisponível não significa zero; não há estimativa nem unidade presumida.','hd-portal-muted'));
 const metrics=node(root,'dl',undefined,'hd-portal-metrics');
 for(const [key,label] of Object.entries(labels)){
  const group=node(root,'div',undefined,'hd-portal-metric'),value=metricText(report.metrics?.[key]);
  group.append(node(root,'dt',label),node(root,'dd',value,value==='Indisponível'?'hd-portal-muted':undefined));metrics.append(group);
 }
 panel.append(metrics);root.append(panel);
}
