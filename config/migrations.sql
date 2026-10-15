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
