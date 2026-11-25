ALTER TABLE itens
ADD COLUMN IF NOT EXISTS miniatura TEXT;

BEGIN;
ALTER TABLE itens ADD COLUMN IF NOT EXISTS padrao BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS itens_um_padrao_idx
ON itens (padrao) WHERE padrao = TRUE;

UPDATE itens SET padrao = TRUE
WHERE id = (
    SELECT i.id FROM itens i
    JOIN subcategoria s ON s.id = i.subcategoria_id
    JOIN categoria c ON c.id = s.categoria_id
    WHERE c.nome = 'Corpo'
    ORDER BY i.id ASC LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM itens WHERE padrao = TRUE);
COMMIT;

SELECT i.id, i.nome, s.nome AS subcategoria, i.padrao
FROM itens i JOIN subcategoria s ON s.id = i.subcategoria_id
JOIN categoria c ON c.id = s.categoria_id
WHERE c.nome = 'Corpo' ORDER BY i.id;

//trocar de corpo padrao quando eu precisar (id é do corpo novo)
BEGIN;
UPDATE itens SET padrao = FALSE WHERE padrao = TRUE;
UPDATE itens SET padrao = TRUE
WHERE id = x
AND subcategoria_id IN (
    SELECT s.id FROM subcategoria s JOIN categoria c ON c.id = s.categoria_id
    WHERE c.nome = 'Corpo'
);
COMMIT;

ALTER TABLE itens ADD COLUMN IF NOT EXISTS pontos_referencia JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Execute uma vez no banco existente, sem apagar itens.
BEGIN;
CREATE TABLE IF NOT EXISTS tamanhos_corpo (
 id SERIAL PRIMARY KEY,
 nome VARCHAR(30) NOT NULL UNIQUE,
 ordem INTEGER NOT NULL DEFAULT 0
);
INSERT INTO tamanhos_corpo(nome,ordem) VALUES ('P',1),('M',2),('G',3)
ON CONFLICT(nome) DO NOTHING;
ALTER TABLE itens ADD COLUMN IF NOT EXISTS tamanho_corpo_id INTEGER REFERENCES tamanhos_corpo(id);
CREATE INDEX IF NOT EXISTS itens_tamanho_corpo_idx ON itens(tamanho_corpo_id);
COMMIT;
-- Os corpos antigos permanecem sem tamanho até serem editados.
-- Para criar outros tamanhos futuramente:
-- INSERT INTO tamanhos_corpo(nome, ordem) VALUES ('GG',4);

-- Execute UMA vez no banco existente (não apaga dados).
CREATE TABLE IF NOT EXISTS bonecas_np (
 id SERIAL PRIMARY KEY,
 nome VARCHAR(120) NOT NULL,
 descricao TEXT NOT NULL DEFAULT '',
 preco NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
 imagem BYTEA,
 ativo BOOLEAN NOT NULL DEFAULT TRUE,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS avaliacoes_np (
 id SERIAL PRIMARY KEY,
 boneca_id INTEGER NOT NULL REFERENCES bonecas_np(id) ON DELETE CASCADE,
 nome VARCHAR(80) NOT NULL,
 estrelas SMALLINT NOT NULL CHECK (estrelas BETWEEN 0 AND 5),
 comentario VARCHAR(2000) NOT NULL,
 foto BYTEA,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS avaliacoes_np_boneca_idx ON avaliacoes_np (boneca_id, criado_em DESC);

-- Executar uma vez no PostgreSQL. Não exclui avaliações anteriores.
BEGIN;
CREATE TABLE IF NOT EXISTS usuarios (
 id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
 senha_hash TEXT NOT NULL, tipo VARCHAR(20) NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente','admin')),
 foto BYTEA, foto_tipo VARCHAR(30), criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS recuperacoes_senha (
 id BIGSERIAL PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 token_hash CHAR(64) NOT NULL UNIQUE, expira_em TIMESTAMPTZ NOT NULL, usado_em TIMESTAMPTZ
);
ALTER TABLE avaliacoes_np ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS avaliacoes_usuario_idx ON avaliacoes_np(usuario_id);
COMMIT;
-- Avaliações antigas continuam com nome e foto originais; novas são vinculadas à conta.

CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL PRIMARY KEY,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire"
ON "session" ("expire");

-- Execute uma vez no banco MalbiDoll, sem apagar dados existentes.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apelido VARCHAR(40);
CREATE TABLE IF NOT EXISTS usuario_enderecos (
 id SERIAL PRIMARY KEY,
 usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 apelido VARCHAR(50),
 cep VARCHAR(9) NOT NULL,
 logradouro VARCHAR(150) NOT NULL,
 numero VARCHAR(20) NOT NULL,
 complemento VARCHAR(100),
 bairro VARCHAR(100) NOT NULL,
 cidade VARCHAR(100) NOT NULL,
 estado CHAR(2) NOT NULL,
 principal BOOLEAN NOT NULL DEFAULT FALSE,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usuario_enderecos_usuario ON usuario_enderecos(usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_endereco_principal_unico ON usuario_enderecos(usuario_id) WHERE principal;
-- Se o usuário da aplicação não for dono das tabelas, conceda SELECT/INSERT/UPDATE/DELETE
-- em usuario_enderecos e SELECT/UPDATE em usuarios, além de USAGE na sequência.

ALTER TABLE itens ADD COLUMN IF NOT EXISTS cores JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Execute uma vez no PostgreSQL, preservando os dados atuais.
CREATE TABLE IF NOT EXISTS favoritos_np (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    boneca_id INTEGER NOT NULL REFERENCES bonecas_np(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, boneca_id)
);
CREATE INDEX IF NOT EXISTS favoritos_np_boneca_idx ON favoritos_np(boneca_id);
ALTER TABLE avaliacoes_np
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS avaliacoes_usuario_idx ON avaliacoes_np(usuario_id);
-- Promova uma conta existente manualmente, substituindo o e-mail:
-- UPDATE usuarios SET tipo = 'admin' WHERE email = 'email-do-administrador@exemplo.com';

UPDATE usuarios
SET tipo = 'admin'
WHERE email = 'marialuisabalim@exemplo.com';

-- Pedidos persistentes e itens congelados no momento da compra.
CREATE TABLE IF NOT EXISTS pedidos (
    id BIGSERIAL PRIMARY KEY,
    numero TEXT NOT NULL UNIQUE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    cliente_nome TEXT NOT NULL,
    cliente_email TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('np', 'personalizada')),
    itens JSONB NOT NULL,
    endereco JSONB NOT NULL,
    frete TEXT NOT NULL,
    valor_frete NUMERIC(10,2) NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    pagamento_metodo TEXT NOT NULL,
    pagamento_status TEXT NOT NULL DEFAULT 'aguardando',
    producao_status TEXT NOT NULL DEFAULT 'aguardando',
    mercado_pago_preferencia_id TEXT,
    mercado_pago_pagamento_id TEXT UNIQUE,
    pago_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pedidos_tipo_data_idx ON pedidos(tipo, criado_em ASC, id ASC);
CREATE INDEX IF NOT EXISTS pedidos_usuario_idx ON pedidos(usuario_id);

-- Progresso sequencial e datas de envio e entrega.

ALTER TABLE pedidos
ADD COLUMN IF NOT EXISTS etapa_producao INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pedidos
ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ;

ALTER TABLE pedidos
ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ;

-- Atualiza os pedidos já existentes.

UPDATE pedidos
SET etapa_producao = CASE
    WHEN producao_status = 'aguardando' THEN 0
    WHEN producao_status = 'em_producao' THEN 1
    WHEN producao_status = 'pronto' THEN
        CASE
            WHEN tipo = 'np' THEN 3
            ELSE 4
        END
    WHEN producao_status IN ('enviado', 'entregue') THEN
        CASE
            WHEN tipo = 'np' THEN 4
            ELSE 5
        END
    ELSE etapa_producao
END
WHERE etapa_producao = 0
  AND producao_status <> 'aguardando';

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entrega_confirmada_por TEXT;

CREATE TABLE IF NOT EXISTS pagamento_historico (
    id BIGSERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    status_anterior TEXT NOT NULL,
    status_novo TEXT NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    administrador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    observacao VARCHAR(200) NOT NULL DEFAULT '',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pagamento_historico_pedido_idx ON pagamento_historico(pedido_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS solicitacoes_reembolso (
 id BIGSERIAL PRIMARY KEY, pedido_id BIGINT NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
 usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 motivo VARCHAR(60) NOT NULL, detalhes VARCHAR(50) NOT NULL DEFAULT '',
 status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), analisado_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS solicitacoes_reembolso_status_idx ON solicitacoes_reembolso(status, criado_em DESC);

-- Moderação de contas e denúncias de avaliações.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_em TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueio_motivo VARCHAR(100);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueio_detalhes VARCHAR(200);
CREATE TABLE IF NOT EXISTS denuncias_avaliacoes (
 id BIGSERIAL PRIMARY KEY,
 avaliacao_id INTEGER NOT NULL REFERENCES avaliacoes_np(id) ON DELETE CASCADE,
 denunciante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 denunciado_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 motivo VARCHAR(40) NOT NULL CHECK(motivo IN ('spam','ofensa','assedio','discriminacao','improprio','outro')),
 detalhes VARCHAR(50) NOT NULL DEFAULT '',
 status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','arquivada','removida')),
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), analisado_em TIMESTAMPTZ,
 administrador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
 UNIQUE(avaliacao_id, denunciante_id)
);
CREATE INDEX IF NOT EXISTS denuncias_denunciado_idx ON denuncias_avaliacoes(denunciado_id);
CREATE INDEX IF NOT EXISTS denuncias_denunciante_idx ON denuncias_avaliacoes(denunciante_id);

ALTER TABLE avaliacoes_np ADD COLUMN IF NOT EXISTS resposta_admin VARCHAR(2000);
ALTER TABLE avaliacoes_np ADD COLUMN IF NOT EXISTS resposta_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS atendimentos (
 id BIGSERIAL PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 assunto VARCHAR(100) NOT NULL, pedido_id BIGINT NULL REFERENCES pedidos(id) ON DELETE SET NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto','em_andamento','aguardando_cliente','resolvido')),
 criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS atendimento_mensagens (
 id BIGSERIAL PRIMARY KEY, atendimento_id BIGINT NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
 autor_id INTEGER NOT NULL REFERENCES usuarios(id), mensagem VARCHAR(3000) NOT NULL,
 lida_em TIMESTAMPTZ, criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atendimento_usuario ON atendimentos(usuario_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens ON atendimento_mensagens(atendimento_id, id);

-- Atividades administrativas para o resumo de auditoria no Dashboard.
CREATE TABLE IF NOT EXISTS auditoria_admin (
  id BIGSERIAL PRIMARY KEY,
  administrador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  acao VARCHAR(50) NOT NULL,
  entidade VARCHAR(30) NOT NULL,
  entidade_id BIGINT,
  descricao VARCHAR(250) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auditoria_admin_data_idx
  ON auditoria_admin (criado_em DESC, id DESC);

CREATE TABLE IF NOT EXISTS atendimento_excecoes (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  sem_limites BOOLEAN NOT NULL DEFAULT FALSE,
  bloqueado_ate TIMESTAMPTZ
);

-- Conversas vinculadas a solicitações de reembolso e anexos privados.
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'geral';
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS reembolso_id BIGINT UNIQUE REFERENCES solicitacoes_reembolso(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS atendimento_anexos (
  id BIGSERIAL PRIMARY KEY,
  mensagem_id BIGINT NOT NULL REFERENCES atendimento_mensagens(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  nome_original VARCHAR(180) NOT NULL,
  mime VARCHAR(20) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atendimento_anexos_mensagem ON atendimento_anexos(mensagem_id);
