export interface Dispensacao {
  id: number;
  codigo_anestesista: string;
  nome_anestesista: string | null;
  codigo_caixa: string;
  codigo_atendimento_paciente: string;
  setor_id: number | null;
  setor_nome: string | null;
  horario_entrega: string;
  horario_devolucao: string | null;
  status: 'em_posse' | 'devolvida';
  observacoes: string | null;
  registrado_por_id: number | null;
  registrado_por_nome: string | null;
  devolvido_por_id: number | null;
  devolvido_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Setor {
  id: number;
  nome: string;
  ativo: number;
  criado_em: string;
}

export interface HistoricoEdicao {
  id: number;
  dispensacao_id: number;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  editado_por_id: number | null;
  editado_por_nome: string | null;
  alterado_em: string;
}

export interface Anestesista {
  codigo_cracha: string;
  nome: string;
  crm: string | null;
  ativo: number;
  criado_em: string;
}

export interface UsuarioPublico {
  id: number;
  login: string;
  nome: string;
  papel: 'admin' | 'funcionario';
  ativo: number;
  criado_em: string;
}
