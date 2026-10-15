CREATE TABLE IF NOT EXISTS categoria (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS subcategoria (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    categoria_id INTEGER NOT NULL,
    FOREIGN KEY (categoria_id)
        REFERENCES categoria(id) ON DELETE CASCADE,
    CONSTRAINT unique_subcategoria_por_categoria
        UNIQUE (nome, categoria_id)
);

CREATE TABLE IF NOT EXISTS itens (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(200),
    preco DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    imagem TEXT NOT NULL,
    miniatura TEXT,
    z_index INTEGER NOT NULL DEFAULT 1,
    subcategoria_id INTEGER NOT NULL,
    FOREIGN KEY (subcategoria_id)
        REFERENCES subcategoria(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS corpos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    caminho_svg TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

GRANT USAGE ON SCHEMA public TO malbidoll;

GRANT ALL PRIVILEGES ON ALL TABLES
IN SCHEMA public TO malbidoll;

GRANT ALL PRIVILEGES ON ALL SEQUENCES
IN SCHEMA public TO malbidoll;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO malbidoll;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO malbidoll;

-- Tamanhos disponíveis para itens da categoria Corpo
CREATE TABLE IF NOT EXISTS tamanhos_corpo (id SERIAL PRIMARY KEY, nome VARCHAR(30) NOT NULL UNIQUE, ordem INTEGER NOT NULL DEFAULT 0);
INSERT INTO tamanhos_corpo(nome,ordem) VALUES ('P',1),('M',2),('G',3) ON CONFLICT(nome) DO NOTHING;
ALTER TABLE itens ADD COLUMN IF NOT EXISTS tamanho_corpo_id INTEGER REFERENCES tamanhos_corpo(id);
