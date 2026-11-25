import test from 'node:test';
import assert from 'node:assert/strict';
import { associarPontos, criarDeformacao, segmentosPath, categoriaDeformavel } from '../public/scripts/deformacaoSVG.js';

const origem = { a: { x: 10, y: 10 }, b: { x: 90, y: 10 }, c: { x: 10, y: 90 }, d: { x: 90, y: 90 } };
const destino = { a: { x: 5, y: 12 }, b: { x: 95, y: 12 }, c: { x: 0, y: 95 }, d: { x: 110, y: 100 } };
const pares = associarPontos(origem, destino);

test('TPS coincide com as quatro âncoras e não altera os dados originais', () => {
  const f = criarDeformacao(pares);
  for (const p of pares) {
    const atual = f(p.origem);
    assert.ok(Math.hypot(atual.x - p.destino.x, atual.y - p.destino.y) < 1e-7);
  }
  assert.deepEqual(origem.a, { x: 10, y: 10 });
  assert.ok(Number.isFinite(f({ x: 50, y: 50 }).x));
});

test('transformação identidade e associação apenas de nomes comuns', () => {
  assert.equal(associarPontos(origem, { a: destino.a }).length, 1);
  const f = criarDeformacao(associarPontos(origem, origem));
  assert.deepEqual(f({ x: 31, y: 57 }), { x: 31, y: 57 });
});

test('rejeita âncoras insuficientes, duplicadas e colineares', () => {
  assert.throws(() => criarDeformacao(pares.slice(0, 2)));
  assert.throws(() => criarDeformacao([...pares, { id: 'e', origem: origem.a, destino: destino.a }]));
  const col = [0, 1, 2].map(x => ({ id: String(x), origem: { x, y: x }, destino: { x, y: x } }));
  assert.throws(() => criarDeformacao(col));
});

test('preserva subcaminhos relativos, fechamento e curvas refletidas', () => {
  const s = segmentosPath('M10 10 h20 v10 z m5 5 c2 3 4 5 6 7 s8 9 10 11 q1 2 3 4 t5 6');
  assert.deepEqual(s.filter(p => p.tipo === 'M').map(p => [p.x, p.y]), [[10, 10], [15, 15]]);
  assert.equal(s[3].tipo, 'Z');
  assert.equal(s[6].d, 'C23 24 29 31 31 33');
  assert.equal(s[8].d, 'Q36 39 39 43');
});

test('interpreta flags de arco compactas e coordenadas exponenciais', () => {
  const s = segmentosPath('M1e1 20 A5 6 0 0110 30');
  assert.equal(s[1].d, 'A5 6 0 0 1 10 30');
  assert.throws(() => segmentosPath('M0 0 C1 2'));
});

test('categorias de roupas correspondem aos IDs do EJS e nomes do banco', () => {
  for (const c of ['Top', 'Vestido', 'Vestidos', 'Bottom', 'Bottoms', 'Meia', 'Meias', 'Sapato', 'Sapatos']) assert.ok(categoriaDeformavel(c));
  for (const c of ['Corpo', 'Rosto', 'Cabelo', 'Acessórios']) assert.ok(!categoriaDeformavel(c));
});
