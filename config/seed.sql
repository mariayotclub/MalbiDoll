INSERT INTO categoria (nome) VALUES
    ('Corpo'),
    ('Rosto'),
    ('Cabelo'),
    ('Maquiagens'),
    ('Top'),
    ('Vestidos'),
    ('Bottoms'),
    ('Meias'),
    ('Sapatos'),
    ('Acessórios'),
    ('Extras')

ON CONFLICT (nome) DO NOTHING;

INSERT INTO subcategoria (nome, categoria_id) VALUES
    ('Fem', (SELECT id FROM categoria WHERE nome = 'Corpo')),
    ('Masc', (SELECT id FROM categoria WHERE nome = 'Corpo')),
    ('N', (SELECT id FROM categoria WHERE nome = 'Corpo')),

    ('Olhos', (SELECT id FROM categoria WHERE nome = 'Rosto')),
    ('Narizes', (SELECT id FROM categoria WHERE nome = 'Rosto')),
    ('Bocas', (SELECT id FROM categoria WHERE nome = 'Rosto')),

    ('CabeloCurto', (SELECT id FROM categoria WHERE nome = 'Cabelo')),
    ('CabeloMedio', (SELECT id FROM categoria WHERE nome = 'Cabelo')),
    ('CabeloComprido', (SELECT id FROM categoria WHERE nome = 'Cabelo')),
    ('CabeloPreso', (SELECT id FROM categoria WHERE nome = 'Cabelo')),

    ('Sombras', (SELECT id FROM categoria WHERE nome = 'Maquiagens')),
    ('Delineados', (SELECT id FROM categoria WHERE nome = 'Maquiagens')),
    ('Labios', (SELECT id FROM categoria WHERE nome = 'Maquiagens')),
    ('Blush', (SELECT id FROM categoria WHERE nome = 'Maquiagens')),
    ('PinturaFacial', (SELECT id FROM categoria WHERE nome = 'Maquiagens')),

    ('Camisas', (SELECT id FROM categoria WHERE nome = 'Top')),
    ('Jaquetas', (SELECT id FROM categoria WHERE nome = 'Top')),
    ('Moletons', (SELECT id FROM categoria WHERE nome = 'Top')),

    ('VestidoCurto', (SELECT id FROM categoria WHERE nome = 'Vestidos')),
    ('VestidoMedio', (SELECT id FROM categoria WHERE nome = 'Vestidos')),
    ('VestidoLongo', (SELECT id FROM categoria WHERE nome = 'Vestidos')),

    ('Calcas', (SELECT id FROM categoria WHERE nome = 'Bottoms')),
    ('Saias', (SELECT id FROM categoria WHERE nome = 'Bottoms')),
    ('Shorts', (SELECT id FROM categoria WHERE nome = 'Bottoms')),

    ('MeiaCalca', (SELECT id FROM categoria WHERE nome = 'Meias')),
    ('MeiaMedia', (SELECT id FROM categoria WHERE nome = 'Meias')),
    ('MeiaCurta', (SELECT id FROM categoria WHERE nome = 'Meias')),

    ('SapatoAlto', (SELECT id FROM categoria WHERE nome = 'Sapatos')),
    ('SapatoCurto', (SELECT id FROM categoria WHERE nome = 'Sapatos')),

    ('Piercing', (SELECT id FROM categoria WHERE nome = 'Acessórios')),
    ('Aneis', (SELECT id FROM categoria WHERE nome = 'Acessórios')),
    ('Colares', (SELECT id FROM categoria WHERE nome = 'Acessórios')),
    ('Pulseira', (SELECT id FROM categoria WHERE nome = 'Acessórios')),
    ('Oculos', (SELECT id FROM categoria WHERE nome = 'Acessórios')),
    ('Luvas', (SELECT id FROM categoria WHERE nome = 'Acessórios')),

    ('Geral', (SELECT id FROM categoria WHERE nome = 'Extras'))

    ON CONFLICT (nome, categoria_id) DO NOTHING;