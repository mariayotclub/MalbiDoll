const SVG_NS = 'http://www.w3.org/2000/svg';
const EPS = 1e-10;

function pontoValido(ponto) {
  return ponto && Number.isFinite(ponto.x) && Number.isFinite(ponto.y);
}

function validarAncoras(ancoras) {
  if (!Array.isArray(ancoras)) {
    throw new TypeError('As ancoras devem ser fornecidas em um array.');
  }

  const ids = new Set();

  return ancoras.map((ancora, indice) => {
    const id = String(ancora?.id ?? indice);

    if (ids.has(id)) {
      throw new Error(`Ancora duplicada: ${id}`);
    }

    if (!pontoValido(ancora?.origem) || !pontoValido(ancora?.destino)) {
      throw new Error(`Coordenadas invalidas na ancora ${id}.`);
    }

    ids.add(id);

    return {
      id,
      origem: { x: ancora.origem.x, y: ancora.origem.y },
      destino: { x: ancora.destino.x, y: ancora.destino.y }
    };
  });
}

function funcaoRadial(distanciaQuadrada) {
  if (distanciaQuadrada < EPS) {
    return 0;
  }

  return distanciaQuadrada * Math.log(distanciaQuadrada);
}

/** Resolve o sistema linear AX=B por eliminacao gaussiana com pivotamento. */
function resolverSistema(matriz, termos) {
  const tamanho = matriz.length;
  const a = matriz.map((linha, indice) => [...linha, ...termos[indice]]);

  for (let coluna = 0; coluna < tamanho; coluna += 1) {
    let melhorLinha = coluna;

    for (let linha = coluna + 1; linha < tamanho; linha += 1) {
      if (Math.abs(a[linha][coluna]) > Math.abs(a[melhorLinha][coluna])) {
        melhorLinha = linha;
      }
    }

    if (Math.abs(a[melhorLinha][coluna]) < EPS) {
      return null;
    }

    [a[coluna], a[melhorLinha]] = [a[melhorLinha], a[coluna]];

    const divisor = a[coluna][coluna];

    for (let indice = coluna; indice < tamanho + 2; indice += 1) {
      a[coluna][indice] /= divisor;
    }

    for (let linha = 0; linha < tamanho; linha += 1) {
      if (linha === coluna) {
        continue;
      }

      const fator = a[linha][coluna];

      for (let indice = coluna; indice < tamanho + 2; indice += 1) {
        a[linha][indice] -= fator * a[coluna][indice];
      }
    }
  }

  return a.map((linha) => linha.slice(tamanho));
}

/**
 * Cria deformacao suave de Thin Plate Spline (TPS) com correspondencia exata
 * nos pontos de ancoragem. Conjuntos degenerados são rejeitados.
 */
export function criarDeformacao(ancoras) {
  const pontos = validarAncoras(ancoras);
  const quantidade = pontos.length;
  const coordenadas = new Set(pontos.map(({ origem }) => `${origem.x},${origem.y}`));
  if (coordenadas.size !== quantidade) throw new Error("Há âncoras sobrepostas na roupa.");

  if (quantidade === 0) {
    return (ponto) => ({ x: ponto.x, y: ponto.y });
  }

  const minimoX = Math.min(...pontos.map(({ origem }) => origem.x));
  const minimoY = Math.min(...pontos.map(({ origem }) => origem.y));
  const maximoX = Math.max(...pontos.map(({ origem }) => origem.x));
  const maximoY = Math.max(...pontos.map(({ origem }) => origem.y));
  const escala = Math.max(maximoX - minimoX, maximoY - minimoY, 1);

  const normalizados = pontos.map((ancora) => ({
    x: (ancora.origem.x - minimoX) / escala,
    y: (ancora.origem.y - minimoY) / escala,
    dx: (ancora.destino.x - ancora.origem.x) / escala,
    dy: (ancora.destino.y - ancora.origem.y) / escala
  }));

  if (quantidade < 3) {
    throw new Error("Cadastre pelo menos três âncoras correspondentes.");
  }

  const tamanho = quantidade + 3;
  const matriz = Array.from({ length: tamanho }, () => Array(tamanho).fill(0));
  const termos = Array.from({ length: tamanho }, () => [0, 0]);

  for (let linha = 0; linha < quantidade; linha += 1) {
    const atual = normalizados[linha];

    for (let coluna = 0; coluna < quantidade; coluna += 1) {
      const outra = normalizados[coluna];
      const dx = atual.x - outra.x;
      const dy = atual.y - outra.y;
      matriz[linha][coluna] = funcaoRadial(dx * dx + dy * dy);
    }

    matriz[linha][quantidade] = 1;
    matriz[linha][quantidade + 1] = atual.x;
    matriz[linha][quantidade + 2] = atual.y;

    matriz[quantidade][linha] = 1;
    matriz[quantidade + 1][linha] = atual.x;
    matriz[quantidade + 2][linha] = atual.y;

    termos[linha] = [atual.dx, atual.dy];
  }

  const coeficientes = resolverSistema(matriz, termos);

  if (!coeficientes) {
    throw new Error("As âncoras precisam ser distintas e não colineares.");
  }

  return (ponto) => {
    if (!pontoValido(ponto)) {
      throw new TypeError('O ponto a deformar precisa conter x e y validos.');
    }

    const x = (ponto.x - minimoX) / escala;
    const y = (ponto.y - minimoY) / escala;

    let deslocamentoX = coeficientes[quantidade][0]
      + coeficientes[quantidade + 1][0] * x
      + coeficientes[quantidade + 2][0] * y;
    let deslocamentoY = coeficientes[quantidade][1]
      + coeficientes[quantidade + 1][1] * x
      + coeficientes[quantidade + 2][1] * y;

    for (let indice = 0; indice < quantidade; indice += 1) {
      const dx = x - normalizados[indice].x;
      const dy = y - normalizados[indice].y;
      const fator = funcaoRadial(dx * dx + dy * dy);
      deslocamentoX += coeficientes[indice][0] * fator;
      deslocamentoY += coeficientes[indice][1] * fator;
    }

    return {
      x: ponto.x + deslocamentoX * escala,
      y: ponto.y + deslocamentoY * escala
    };
  };
}

// Os pontos já armazenados no PostgreSQL são objetos indexados por nome.
export function associarPontos(roupa = {}, corpo = {}) {
  return Object.entries(roupa || {})
    .filter(([nome, ponto]) => pontoValido(ponto) &&
      Object.hasOwn(corpo || {}, nome) && pontoValido(corpo[nome]))
    .map(([id, origem]) => ({ id, origem, destino: corpo[id] }));
}

export function lerViewBox(svg) {
  const vb = svg.viewBox.baseVal;
  if (vb.width > 0 && vb.height > 0) return [vb.x, vb.y, vb.width, vb.height];
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  if (w > 0 && h > 0) return [0, 0, w, h];
  throw new Error('O SVG precisa de um viewBox ou dimensões numéricas.');
}

// Normaliza os comandos para coordenadas absolutas. Mantém os vértices,
// os subcaminhos e as curvas refletidas de S e T durante a amostragem.
export function segmentosPath(d) {
  const scanner = /\s*,?\s*([a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?)/y;
  let pos = 0;
  let comando = '';
  let x = 0, y = 0, mx = 0, my = 0;
  let anterior = '', controle = null;
  const segmentos = [];
  const quantidades = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  function ler(flag = false) {
    const separador = /^[\s,]*/.exec(d.slice(pos))[0];
    pos += separador.length;
    if (flag) {
      const valor = d[pos++];
      if (valor !== '0' && valor !== '1') throw new Error('Flag de arco inválida.');
      return Number(valor);
    }
    scanner.lastIndex = pos;
    const token = scanner.exec(d);
    if (!token) throw new Error('Comando SVG inválido.');
    pos = scanner.lastIndex;
    return token[1];
  }
  while (pos < d.length) {
    if (!d.slice(pos).trim()) break;
    const inicio = pos;
    const token = ler();
    if (/^[a-zA-Z]$/.test(token)) comando = token;
    else pos = inicio;
    const tipo = comando.toUpperCase();
    const relativo = comando !== tipo;
    const inicioX = x, inicioY = y;
    if (tipo === 'Z') {
      segmentos.push({ tipo: 'Z', x: mx, y: my, inicioX, inicioY, d: `L${mx} ${my}` });
      x = mx; y = my;
      anterior = tipo; controle = null; comando = '';
      continue;
    }
    if (!Object.hasOwn(quantidades, tipo)) throw new Error('Comando SVG não reconhecido.');
    const p = Array.from({ length: quantidades[tipo] }, (_, i) =>
      Number(ler(tipo === 'A' && (i === 3 || i === 4))));
    if (!p.every(Number.isFinite)) throw new Error('Coordenada SVG inválida.');
    const px = v => v + (relativo ? inicioX : 0);
    const py = v => v + (relativo ? inicioY : 0);
    let caminho;
    let novoControle = null;
    switch (tipo) {
      case 'M':
        x = px(p[0]); y = py(p[1]); mx = x; my = y;
        comando = relativo ? 'l' : 'L';
        break;
      case 'H': x = px(p[0]); caminho = `L${x} ${y}`; break;
      case 'V': y = py(p[0]); caminho = `L${x} ${y}`; break;
      case 'L': x = px(p[0]); y = py(p[1]); caminho = `L${x} ${y}`; break;
      case 'C':
        x = px(p[4]); y = py(p[5]);
        novoControle = [px(p[2]), py(p[3])];
        caminho = `C${px(p[0])} ${py(p[1])} ${novoControle.join(' ')} ${x} ${y}`;
        break;
      case 'S': {
        const c = ['C', 'S'].includes(anterior) && controle
          ? [2 * inicioX - controle[0], 2 * inicioY - controle[1]] : [inicioX, inicioY];
        x = px(p[2]); y = py(p[3]); novoControle = [px(p[0]), py(p[1])];
        caminho = `C${c.join(' ')} ${novoControle.join(' ')} ${x} ${y}`;
        break;
      }
      case 'Q':
        x = px(p[2]); y = py(p[3]); novoControle = [px(p[0]), py(p[1])];
        caminho = `Q${novoControle.join(' ')} ${x} ${y}`;
        break;
      case 'T':
        novoControle = ['Q', 'T'].includes(anterior) && controle
          ? [2 * inicioX - controle[0], 2 * inicioY - controle[1]] : [inicioX, inicioY];
        x = px(p[0]); y = py(p[1]); caminho = `Q${novoControle.join(' ')} ${x} ${y}`;
        break;
      case 'A':
        x = px(p[5]); y = py(p[6]); caminho = `A${p.slice(0, 5).join(' ')} ${x} ${y}`;
        break;
    }
    segmentos.push({ tipo, x, y, inicioX, inicioY, d: caminho });
    anterior = tipo;
    controle = novoControle;
  }
  if (segmentos.length && segmentos[0].tipo !== 'M') throw new Error('O path deve começar com M.');
  return segmentos;
}

// Compõe os transforms SVG de cada grupo em coordenadas da raiz, sem
// depender da escala CSS, do tamanho da prévia ou de getScreenCTM em SVG aninhado.
function matrizAteRaiz(elemento, raiz) {
  let resultado = new DOMMatrix();
  for (let atual = elemento; atual && atual !== raiz; atual = atual.parentElement) {
    const lista = atual.transform?.baseVal;
    let local = new DOMMatrix();
    if (lista) {
      for (let i = 0; i < lista.numberOfItems; i++) {
        const m = lista.getItem(i).matrix;
        local = local.multiply(new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]));
      }
    }
    resultado = local.multiply(resultado);
  }
  return resultado;
}

function transformar(ponto, matriz) {
  return new DOMPoint(ponto.x, ponto.y).matrixTransform(matriz);
}

function formatar(ponto) {
  if (!Number.isFinite(ponto.x) || !Number.isFinite(ponto.y)) {
    throw new Error('A deformação gerou coordenadas inválidas.');
  }
  return `${Number(ponto.x.toFixed(4))} ${Number(ponto.y.toFixed(4))}`;
}

const DEFINICOES = 'defs, clipPath, mask, pattern, marker, symbol, filter';

// Deforma em coordenadas da raiz da roupa e depois usa o viewBox do corpo.
// O SVG deve estar montado no DOM. Nenhuma alteração é aplicada até que
// todos os caminhos tenham sido calculados com sucesso.
export function deformarRoupa(svg, corpo, pares) {
  if (pares.length < 3) throw new Error('São necessárias três âncoras correspondentes e não alinhadas.');
  const deformar = criarDeformacao(pares);
  const vbRoupa = lerViewBox(svg);
  const vbCorpo = lerViewBox(corpo);
  if (svg.querySelector('svg')) throw new Error('SVGs aninhados ainda não são suportados.');
  const visivel = el => !el.closest(DEFINICOES) && getComputedStyle(el).display !== 'none';
  const incompatibilidade = [...svg.querySelectorAll('image, text, use, rect, circle, ellipse, line, polyline, polygon')].some(visivel);
  if (incompatibilidade || svg.querySelector('[clip-path], [mask], [filter]')) {
    throw new Error('Converta as formas em paths; imagens, textos, máscaras e filtros ainda não são suportados.');
  }
  const caminhos = [...svg.querySelectorAll('path')].filter(visivel);
  if (!caminhos.length) throw new Error('Nenhum path disponível para deformar.');
  const auxiliar = document.createElementNS(SVG_NS, 'path');
  const passo = Math.max(vbRoupa[2], vbRoupa[3]) / 550;
  let total = 0;
  const alteracoes = [];
  for (const path of caminhos) {
    const paraRaiz = matrizAteRaiz(path, svg);
    const paraLocal = paraRaiz.inverse();
    const escala = Math.max(Math.hypot(paraRaiz.a, paraRaiz.b), Math.hypot(paraRaiz.c, paraRaiz.d));
    const mapear = p => formatar(transformar(deformar(transformar(p, paraRaiz)), paraLocal));
    const comandos = [];
    for (const s of segmentosPath(path.getAttribute('d') || '')) {
      if (s.tipo === 'M') {
        comandos.push(`M${mapear(s)}`);
        continue;
      }
      auxiliar.setAttribute('d', `M${s.inicioX} ${s.inicioY} ${s.d}`);
      const comprimento = auxiliar.getTotalLength();
      if (!Number.isFinite(comprimento)) throw new Error('Comprimento de path inválido.');
      const n = Math.max(1, Math.min(1200, Math.ceil(comprimento * escala / passo - 1e-9)));
      total += n;
      if (total > 100000) throw new Error('O SVG é complexo demais para esta versão da deformação.');
      for (let i = 1; i <= n; i++) {
        if (s.tipo === 'Z' && i === n) break;
        const ponto = i === n ? s : auxiliar.getPointAtLength(comprimento * i / n);
        comandos.push(`L${mapear(ponto)}`);
      }
      if (s.tipo === 'Z') comandos.push('Z');
    }
    if (comandos.length) alteracoes.push([path, comandos.join(' ')]);
  }
  for (const [path, d] of alteracoes) path.setAttribute('d', d);
  svg.setAttribute('viewBox', vbCorpo.join(' '));
  svg.setAttribute('preserveAspectRatio', corpo.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
  return { quantidade: pares.length, segmentos: total };
}

export async function buscarPontos(id) {
  const resposta = await fetch(`/api/itens/${encodeURIComponent(id)}/pontos`);
  if (!resposta.ok) throw new Error('Não foi possível carregar as âncoras.');
  const dados = await resposta.json();
  return dados.pontos_referencia || {};
}

export function categoriaDeformavel(categoria) {
  return ['top', 'vestido', 'vestidos', 'bottom', 'bottoms', 'meia', 'meias', 'sapato', 'sapatos']
    .includes(String(categoria || '').trim().toLowerCase());
}

// A prévia administrativa recebe também arquivos locais ainda não validados
// pelo servidor. Copia somente elementos e atributos vetoriais passivos.
export function lerSvgParaPrevia(texto) {
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
  const raiz = doc.documentElement;
  if (doc.querySelector('parsererror') || raiz.localName !== 'svg' || raiz.namespaceURI !== SVG_NS) {
    throw new Error('SVG inválido.');
  }
  const tags = new Set(['svg', 'g', 'path', 'defs', 'clipPath', 'mask', 'pattern', 'marker', 'symbol',
    'filter', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'image', 'text', 'tspan',
    'linearGradient', 'radialGradient', 'stop', 'title', 'desc']);
  const estilos = new Set(['fill', 'stroke', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width',
    'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-miterlimit', 'display', 'visibility']);
  const atributos = new Set([...estilos, 'id', 'class', 'xmlns', 'xmlns:xlink', 'viewBox', 'preserveAspectRatio',
    'd', 'transform', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2',
    'points', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'fx', 'fy',
    'clip-path', 'mask', 'filter', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'patternUnits',
    'patternContentUnits', 'patternTransform', 'href', 'xlink:href']);
  const valorSeguro = valor => /^[#a-zA-Z0-9.,%\s+-]+$/.test(valor);
  for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
    if (el.namespaceURI !== SVG_NS || !tags.has(el.localName)) {
      el.remove();
      continue;
    }
    for (const regra of (el.getAttribute('style') || '').split(';')) {
      const i = regra.indexOf(':');
      if (i < 0) continue;
      const nome = regra.slice(0, i).trim();
      const valor = regra.slice(i + 1).trim();
      if (estilos.has(nome) && valorSeguro(valor)) el.setAttribute(nome, valor);
    }
    for (const atributo of [...el.attributes]) {
      const { name, value } = atributo;
      const referencia = name === 'href' || name === 'xlink:href';
      const png = el.localName === 'image' && /^data:image\/png;base64,[a-zA-Z0-9+/=\s]+$/.test(value);
      if (!atributos.has(name) || (referencia && !png) || /url\s*\(|@import|expression\s*\(/i.test(value)) {
        el.removeAttributeNode(atributo);
      }
    }
  }
  return raiz;
}
