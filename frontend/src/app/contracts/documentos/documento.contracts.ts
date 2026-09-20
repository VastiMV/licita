/**
 * Contratos do dossiê de habilitação da empresa — ver `apps/documentos` no
 * backend.
 *
 * A forma reflete a decisão de produto: **a vaga é a linha, a versão é o
 * arquivo**. `Documento` é o tipo de documento naquela empresa e não guarda
 * validade nenhuma; quem tem número, emissão e validade é a versão corrente,
 * porque renovar uma certidão não corrige uma data — cria outra certidão.
 *
 * `situacao` vem **calculada** pelo backend contra a data de hoje e é só de
 * leitura. Nenhuma tela decide se algo venceu.
 */

export type BlocoDocumento = 'juridica' | 'fiscal' | 'economica' | 'tecnica' | 'outros';
export type SituacaoDocumento = 'pendente' | 'valido' | 'a_vencer' | 'vencido' | 'arquivado';

export interface VersaoDocumento {
  readonly id: number;
  readonly versao: number;
  readonly numero: string;
  readonly emissao: string | null;
  readonly validade: string | null;
  readonly nome_original: string;
  readonly extensao: string;
  readonly tamanho: number;
  readonly nota: string;
  readonly enviado_por_nome: string;
  readonly enviado_em: string;
}

export interface DocumentoResponse {
  readonly id: number;
  readonly empresa: number;
  readonly tipo: number;
  readonly tipo_nome: string;
  readonly titulo: string;
  /** O que aparece na linha: o título do tipo livre, ou o nome do tipo. */
  readonly nome: string;
  readonly orgao_emissor: string;
  readonly bloco: BlocoDocumento;
  readonly bloco_label: string;
  readonly exige_validade: boolean;
  /** Para onde mandar quem precisa renovar. Vazio em estadual e municipal,
   * que dependem da UF e do município. */
  readonly link_emissor: string;
  readonly observacoes: string;
  readonly situacao: SituacaoDocumento;
  /** "Vence em 4 dias", "Vencido há 20 dias", "Vigente" — já pronto: o
   * número é o que faz agir, e a tela não deve recalcular data. */
  readonly situacao_label: string;
  readonly validade: string | null;
  readonly dias_para_vencer: number | null;
  readonly versao_atual: VersaoDocumento | null;
  readonly total_versoes: number;
  readonly arquivado_em: string | null;
}

/** A lista vem com os contadores no mesmo lugar — pedi-los em outra chamada
 * deixaria a tela com número de um momento e linhas de outro. */
export interface DocumentosResposta {
  readonly results: readonly DocumentoResponse[];
  readonly validos: number;
  readonly a_vencer: number;
  readonly vencidos: number;
  readonly pendentes: number;
}

export interface TipoDocumento {
  readonly id: number;
  readonly bloco: BlocoDocumento;
  readonly bloco_label: string;
  readonly nome: string;
  readonly orgao_emissor: string;
  readonly exige_validade: boolean;
  readonly obrigatorio: boolean;
  readonly link_emissor: string;
  readonly ordem: number;
}

export interface NovaVersao {
  readonly arquivo: File;
  readonly numero?: string;
  readonly emissao?: string;
  readonly validade?: string;
  readonly nota?: string;
}

/** O que o upload devolve: a versão criada e a linha já recalculada, para a
 * tela redesenhar sem outra chamada. */
export interface VersaoCriada {
  readonly versao: VersaoDocumento;
  readonly documento: DocumentoResponse;
}

/** Progresso de um envio: `pct` de 0 a 100 enquanto sobe, e o resultado
 * quando termina. */
export interface ProgressoUpload {
  readonly pct: number;
  readonly resultado?: VersaoCriada;
}

export interface EventoDocumento {
  readonly id: number;
  readonly tipo: string;
  readonly tipo_label: string;
  readonly detalhe: string;
  readonly autor_nome: string;
  readonly quando: string;
}

/** Os blocos da Lei 14.133, na ordem em que os editais pedem — é assim que a
 * lista do modal se agrupa. */
export const BLOCOS: readonly { readonly value: BlocoDocumento; readonly label: string }[] = [
  { value: 'juridica', label: 'Habilitação jurídica' },
  { value: 'fiscal', label: 'Fiscal, social e trabalhista' },
  { value: 'economica', label: 'Econômico-financeira' },
  { value: 'tecnica', label: 'Técnica' },
  { value: 'outros', label: 'Outros' },
];

/** O tom da pílula, casado com o design system (ver `TomCelula`). */
export const TOM_SITUACAO: Record<SituacaoDocumento, 'sucesso' | 'alerta' | 'perigo' | null> = {
  valido: 'sucesso',
  a_vencer: 'alerta',
  vencido: 'perigo',
  pendente: null,
  arquivado: null,
};
