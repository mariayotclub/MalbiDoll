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

