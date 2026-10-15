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
