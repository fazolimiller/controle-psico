'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { Anestesista } from '@/lib/types';

interface Props {
  onSucesso: () => void;
}

export default function FormularioEntrega({ onSucesso }: Props) {
  const [codigoAnestesista, setCodigoAnestesista] = useState('');
  const [codigoCaixa, setCodigoCaixa] = useState('');
  const [codigoPaciente, setCodigoPaciente] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [crachaLido, setCrachaLido] = useState(false);
  const [anestesistas, setAnestesistas] = useState<Anestesista[]>([]);

  const crachaRef = useRef<HTMLInputElement>(null);
  const caixaRef = useRef<HTMLInputElement>(null);
  const pacienteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    crachaRef.current?.focus();
    fetch('/api/anestesistas')
      .then((res) => (res.ok ? res.json() : []))
      .then(setAnestesistas)
      .catch(() => {});
  }, []);

  const anestesistaEncontrado = anestesistas.find(
    (a) => a.codigo_cracha === codigoAnestesista.trim() && a.ativo
  );
  const crachaDigitado = codigoAnestesista.trim().length > 0;
  const crachaNaoCadastrado = crachaDigitado && !anestesistaEncontrado;

  function handleCrachaChange(valor: string) {
    setCodigoAnestesista(valor);
    setCrachaLido(valor.length > 0);
  }

  // Leitor de crachá (HID) normalmente envia um Enter ao final da leitura —
  // usamos isso para avançar automaticamente pro próximo campo.
  function handleCrachaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && codigoAnestesista.trim()) {
      e.preventDefault();
      caixaRef.current?.focus();
    }
  }

  function handleCaixaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && codigoCaixa.trim()) {
      e.preventDefault();
      pacienteRef.current?.focus();
    }
  }

  const recarregarAnestesistas = useCallback(() => {
    fetch('/api/anestesistas')
      .then((res) => (res.ok ? res.json() : []))
      .then(setAnestesistas)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');

    if (!codigoAnestesista.trim() || !codigoCaixa.trim() || !codigoPaciente.trim()) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!anestesistaEncontrado) {
      setErro(
        'Este crachá não está cadastrado. Peça a um administrador para vincular o anestesista em Administração → Anestesistas antes de dispensar a caixa.'
      );
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/dispensacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_anestesista: codigoAnestesista.trim(),
          codigo_caixa: codigoCaixa.trim(),
          codigo_atendimento_paciente: codigoPaciente.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao registrar entrega.');
      }

      setCodigoAnestesista('');
      setCodigoCaixa('');
      setCodigoPaciente('');
      setCrachaLido(false);
      onSucesso();
      recarregarAnestesistas();
      crachaRef.current?.focus();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar entrega.');
    } finally {
      setEnviando(false);
    }
  }

  const podeEnviar = !enviando && crachaDigitado && !!anestesistaEncontrado;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border p-5"
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
    >
      <h2 className="font-display text-lg mb-4" style={{ color: 'var(--ink)' }}>
        Registrar nova entrega
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Campo de crachá — o "herói" da tela */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
            Crachá do anestesista
          </label>
          <div className="relative">
            <input
              ref={crachaRef}
              type="text"
              value={codigoAnestesista}
              onChange={(e) => handleCrachaChange(e.target.value)}
              onKeyDown={handleCrachaKeyDown}
              placeholder="Aproxime o crachá do leitor"
              className="font-mono w-full rounded-lg border-2 px-3 py-3 text-base"
              style={{
                borderColor: crachaNaoCadastrado ? 'var(--red)' : anestesistaEncontrado ? 'var(--accent)' : 'var(--line)',
                background: crachaNaoCadastrado
                  ? 'var(--red-soft)'
                  : anestesistaEncontrado
                    ? 'var(--accent-soft)'
                    : 'var(--bg)',
              }}
              autoComplete="off"
            />
            {crachaLido && anestesistaEncontrado && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                ✓ lido
              </span>
            )}
          </div>
          <p
            className="text-xs mt-1.5 min-h-4"
            style={{ color: crachaNaoCadastrado ? 'var(--red)' : anestesistaEncontrado ? 'var(--accent)' : 'var(--ink-soft)' }}
          >
            {crachaDigitado
              ? anestesistaEncontrado?.nome ||
                'Crachá não cadastrado — peça a um admin para vincular antes de dispensar'
              : ''}
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
            Código da caixa
          </label>
          <input
            ref={caixaRef}
            type="text"
            value={codigoCaixa}
            onChange={(e) => setCodigoCaixa(e.target.value)}
            onKeyDown={handleCaixaKeyDown}
            placeholder="Ex: CX-014"
            className="font-mono w-full rounded-lg border px-3 py-3 text-base"
            style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
            Aviso Cirúrgico
          </label>
          <input
            ref={pacienteRef}
            type="text"
            value={codigoPaciente}
            onChange={(e) => setCodigoPaciente(e.target.value)}
            placeholder="Código do aviso cirúrgico"
            className="font-mono w-full rounded-lg border px-3 py-3 text-base"
            style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
            autoComplete="off"
          />
        </div>
      </div>

      {erro && (
        <p className="text-sm mt-3 rounded-lg px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-soft)' }}>
          {erro}
        </p>
      )}

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          Horário de entrega é registrado automaticamente ao confirmar.
        </p>
        <button
          type="submit"
          disabled={!podeEnviar}
          className="rounded-lg px-5 py-2.5 font-medium text-white disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          {enviando ? 'Registrando…' : 'Registrar entrega'}
        </button>
      </div>
    </form>
  );
}
