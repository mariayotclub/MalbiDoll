// Editor de pontos de referência — sem dependências externas.
document.addEventListener('DOMContentLoaded', () => {
    const NS = 'http://www.w3.org/2000/svg';
    document.querySelectorAll('[data-editor-pontos]').forEach(painel => {
        const prefixo = painel.dataset.prefixo;
        const form = painel.closest('form');
        const inputArquivo = document.getElementById(prefixo + 'imagemInput');
        const imagem = painel.querySelector('.pontos-imagem');
        const camada = painel.querySelector('.pontos-camada');
        const vazio = painel.querySelector('.pontos-vazio');
        const nome = painel.querySelector('.pontos-nome');
        const personalizado = painel.querySelector('.pontos-personalizado');
        const saida = painel.querySelector('.pontos-json');
        const lista = painel.querySelector('.pontos-lista');
        const coordenadas = painel.querySelector('.pontos-coordenadas');
        let pontos = {};
        let selecionado = null;
        const selecionados = new Set();
        let gesto = null;
        let retangulo = null;
        const arredondar = valor => Math.round(valor * 100) / 100;
        let urlAtual = null;
        let pronto = false;
        let versao = 0;
        let svgFonte = '';
        let automaticos = [];
        const mostrarAutomaticos = painel.querySelector('.pontos-mostrar-auto');
        const nomesAnatomicos = new Set([
            'ombroEsquerdo', 'ombroDireito', 'axilaEsquerda', 'axilaDireita',
            'cinturaEsquerda', 'cinturaDireita', 'quadrilEsquerdo', 'quadrilDireito'
        ]);
        const atualizarJSON = () => { saida.value = JSON.stringify(pontos); };
        const nomeAtual = () => personalizado.value.trim() || nome.value;
        const exibir = () => {
            camada.replaceChildren();
            lista.replaceChildren();
            for (const [chave, ponto] of Object.entries(pontos)) {
                const circulo = document.createElementNS(NS, 'circle');
                circulo.setAttribute('cx', ponto.x);
                circulo.setAttribute('cy', ponto.y);
                const vb = camada.viewBox.baseVal;
                circulo.setAttribute('r', Math.max(vb.width, vb.height) * (nomesAnatomicos.has(chave) ? .009 : .007));
                circulo.setAttribute('fill', selecionados.has(chave) ? '#e05242' : (nomesAnatomicos.has(chave) ? '#e8a13d' : '#8059aa'));
                circulo.setAttribute('pointer-events', 'all');
                circulo.style.cursor = 'grab';
                circulo.setAttribute('stroke', 'white');
                circulo.setAttribute('stroke-width', Math.max(vb.width, vb.height) * .002);
                circulo.dataset.ponto = chave;
                // Área de clique maior e invisível: facilita selecionar sem alterar a aparência.
                const alvo = document.createElementNS(NS, 'circle');
                alvo.setAttribute('cx', ponto.x);
                alvo.setAttribute('cy', ponto.y);
                alvo.setAttribute('r', Math.max(vb.width, vb.height) * .017);
                alvo.setAttribute('fill', 'transparent');
                alvo.setAttribute('pointer-events', 'all');
                alvo.dataset.ponto = chave;
                alvo.style.cursor = 'grab';
                camada.append(circulo, alvo);
                const botao = document.createElement('button');
                botao.type = 'button';
                botao.textContent = chave;
                botao.classList.toggle('ativo', selecionados.has(chave));
                botao.addEventListener('click', evento => selecionar(chave, evento.shiftKey));
                lista.append(botao);
            }
            // Pontos automáticos são apenas uma camada visual e não entram no JSON salvo.
            if (mostrarAutomaticos?.checked) {
                const vb = camada.viewBox.baseVal;
                const raio = Math.max(vb.width, vb.height) * .0038;
                const grupo = document.createElementNS(NS, 'g');
                grupo.setAttribute('pointer-events', 'none');
                for (const pos of automaticos) {
                    const c = document.createElementNS(NS, 'circle');
                    c.setAttribute('cx', pos.x);
                    c.setAttribute('cy', pos.y);
                    c.setAttribute('r', raio);
                    c.setAttribute('fill', '#258bd2');
                    c.setAttribute('stroke', '#fff');
                    c.setAttribute('stroke-width', raio * .35);
                    grupo.append(c);
                }
                camada.append(grupo);
            }
            coordenadas.textContent = selecionados.size > 1
                ? `${selecionados.size} pontos selecionados`
                : selecionado && pontos[selecionado]
                    ? `${selecionado}: x ${pontos[selecionado].x}, y ${pontos[selecionado].y}`
                    : 'Nenhum ponto selecionado';
            atualizarJSON();
        };
        function selecionar(chave, adicionar = false) {
            if (!adicionar) selecionados.clear();
            if (adicionar && selecionados.has(chave)) selecionados.delete(chave);
            else selecionados.add(chave);
            selecionado = selecionados.has(chave) ? chave : (selecionados.values().next().value || null);
            // Não reutilizar automaticamente o nome de um ponto ao clicar em área vazia.
            personalizado.value = '';
            redesenhar();
        }
        function coordenada(evento) {
            const ponto = camada.createSVGPoint();
            ponto.x = evento.clientX;
            ponto.y = evento.clientY;
            const matriz = camada.getScreenCTM();
            if (!matriz) return null;
            const pos = ponto.matrixTransform(matriz.inverse());
            return { x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100 };
        }
        function definir(chave, pos) {
            if (!/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(chave)) { alert('Use um nome sem espaços, começando por letra.'); return; }
            if (!pontos[chave] && Object.keys(pontos).length >= 80) return;
            pontos[chave] = pos;
            selecionados.clear();
            selecionados.add(chave);
            selecionado = chave;
            redesenhar();
        }
        // O SVG sem preenchimento não recebe cliques no fundo em todos os navegadores.
        // Um retângulo transparente torna a área inteira interativa.
        const fundo = document.createElementNS(NS, 'rect');
        fundo.setAttribute('fill', 'transparent');
        fundo.setAttribute('pointer-events', 'all');
        // O fundo é recolocado primeiro a cada renderização.
        const exibirOriginal = exibir;
        // Um MutationObserver não é necessário: inserimos o fundo após cada redesenho
        // através da função dedicada abaixo.
        function prepararFundo() {
            if (!pronto) return;
            const vb = camada.viewBox.baseVal;
            if (!vb || vb.width <= 0 || vb.height <= 0) return;
            fundo.setAttribute('x', vb.x);
            fundo.setAttribute('y', vb.y);
            fundo.setAttribute('width', vb.width);
            fundo.setAttribute('height', vb.height);
            camada.prepend(fundo);
        }
        // Preserva a camada de fundo e o retângulo de seleção durante o desenho.
        function redesenhar() {
            if (!pronto) {
                camada.replaceChildren();
                lista.replaceChildren();
                coordenadas.textContent = 'Nenhum ponto selecionado';
                atualizarJSON();
                return;
            }
            exibirOriginal();
            prepararFundo();
            if (gesto?.tipo === 'retangulo') desenharRetangulo();
        }
        function desenharRetangulo() {
            if (retangulo) retangulo.remove();
            if (!gesto || gesto.tipo !== 'retangulo') return;
            const x = Math.min(gesto.inicio.x, gesto.atual.x);
            const y = Math.min(gesto.inicio.y, gesto.atual.y);
            retangulo = document.createElementNS(NS, 'rect');
            retangulo.setAttribute('x', x);
            retangulo.setAttribute('y', y);
            retangulo.setAttribute('width', Math.abs(gesto.atual.x - gesto.inicio.x));
            retangulo.setAttribute('height', Math.abs(gesto.atual.y - gesto.inicio.y));
            retangulo.setAttribute('fill', '#3987cb');
            retangulo.setAttribute('fill-opacity', '.15');
            retangulo.setAttribute('stroke', '#3987cb');
            retangulo.setAttribute('stroke-dasharray', '5 4');
            retangulo.setAttribute('pointer-events', 'none');
            camada.append(retangulo);
        }
        camada.addEventListener('pointerdown', evento => {
            if (!pronto || evento.button !== 0) return;
            const pos = coordenada(evento);
            if (!pos) return;
            const existente = evento.target.closest('[data-ponto]')?.dataset.ponto;
            if (existente) {
                if (evento.shiftKey) {
                    selecionar(existente, true);
                    redesenhar();
                    return;
                }
                if (!selecionados.has(existente)) selecionar(existente);
                gesto = { tipo: 'mover', inicio: pos, atual: pos };
            } else {
                // Arrastar no fundo seleciona por retângulo; clicar no fundo desmarca.
                gesto = { tipo: 'retangulo', inicio: pos, atual: pos, adicionar: evento.shiftKey };
                if (!evento.shiftKey) selecionados.clear();
            }
            camada.setPointerCapture(evento.pointerId);
            redesenhar();
            evento.preventDefault();
        });
        camada.addEventListener('pointermove', evento => {
            if (!gesto) return;
            const pos = coordenada(evento);
            if (!pos) return;
            if (gesto.tipo === 'mover') {
                const dx = pos.x - gesto.atual.x;
                const dy = pos.y - gesto.atual.y;
                for (const chave of selecionados) {
                    if (!pontos[chave]) continue;
                    pontos[chave] = { x: arredondar(pontos[chave].x + dx), y: arredondar(pontos[chave].y + dy) };
                }
            }
            gesto.atual = pos;
            redesenhar();
        });
        camada.addEventListener('pointerup', evento => {
            if (!gesto) return;
            if (gesto.tipo === 'retangulo') {
                const { inicio, atual } = gesto;
                const x1 = Math.min(inicio.x, atual.x), x2 = Math.max(inicio.x, atual.x);
                const y1 = Math.min(inicio.y, atual.y), y2 = Math.max(inicio.y, atual.y);
                if (Math.hypot(atual.x - inicio.x, atual.y - inicio.y) > 3) {
                    for (const [chave, ponto] of Object.entries(pontos)) {
                        if (ponto.x >= x1 && ponto.x <= x2 && ponto.y >= y1 && ponto.y <= y2) selecionados.add(chave);
                    }
                    selecionado = selecionados.values().next().value || null;
                } else if (!gesto.adicionar) {
                    // Clique simples no fundo cria o ponto; arraste cria seleção.
                    definir(nomeAtual(), atual);
                } else {
                    selecionado = selecionados.values().next().value || null;
                }
            }
            gesto = null;
            retangulo?.remove();
            retangulo = null;
            redesenhar();
        });
        camada.addEventListener('pointercancel', () => { gesto = null; redesenhar(); });
        painel.querySelector('.pontos-excluir').addEventListener('click', () => {
            for (const chave of selecionados) delete pontos[chave];
            selecionados.clear();
            selecionado = null;
            personalizado.value = '';
            redesenhar();
        });
        painel.querySelector('.pontos-selecionar-todos')?.addEventListener('click', () => {
            selecionados.clear();
            Object.keys(pontos).forEach(chave => selecionados.add(chave));
            selecionado = selecionados.values().next().value || null;
            redesenhar();
        });
        painel.querySelector('.pontos-limpar-selecao')?.addEventListener('click', () => {
            selecionados.clear();
            selecionado = null;
            redesenhar();
        });
        // Amostragem de caminhos vetoriais: usa o comprimento real do path.
        // Os pontos não são persistidos, pois dependem do SVG e do espaçamento escolhido.
        function calcularAutomaticos() {
            automaticos = [];
            if (!svgFonte || !pronto) return;
            const doc = new DOMParser().parseFromString(svgFonte, 'image/svg+xml');
            if (doc.querySelector('parsererror')) return;
            const raiz = doc.documentElement;
            const auxiliar = document.createElementNS(NS, 'svg');
            const vb = camada.viewBox.baseVal;
            auxiliar.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
            auxiliar.setAttribute('width', vb.width);
            auxiliar.setAttribute('height', vb.height);
            auxiliar.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none';
            // Copia os estilos internos e a estrutura para manter transforms e herança de stroke.
            for (const filho of Array.from(raiz.children)) auxiliar.appendChild(document.importNode(filho, true));
            painel.appendChild(auxiliar);
            try {
                const caminhos = Array.from(auxiliar.querySelectorAll('path'));
                const passo = Math.max(2, 20);
                const matrizRaiz = auxiliar.getScreenCTM();
                if (!matrizRaiz) throw new Error('Não foi possível ler a geometria do SVG.');
                const inversa = matrizRaiz.inverse();
                let candidatos = 0;
                for (const path of caminhos) {
                    const estilo = getComputedStyle(path);
                    const stroke = estilo.stroke;
                    const atributo = path.getAttribute('stroke');
                    const ehLinha = path.id === 'line' || path.id?.startsWith('line') || path.classList.contains('line') ||
                        (stroke && stroke !== 'none' && stroke !== 'transparent') ||
                        (atributo && atributo !== 'none');
                    if (!ehLinha || estilo.display === 'none') continue;
                    candidatos++;
                    let comprimento;
                    try { comprimento = path.getTotalLength(); } catch { continue; }
                    if (!Number.isFinite(comprimento) || comprimento <= 0) continue;
                    const matriz = path.getScreenCTM();
                    if (!matriz) continue;
                    const paraRaiz = inversa.multiply(matriz);
                    // Ignora o início/fim: os 8 pontos anatômicos continuam independentes.
                    const quantidade = Math.min(90, Math.max(0, Math.floor(comprimento / passo) - 1));
                    for (let i = 1; i <= quantidade && automaticos.length < 400; i++) {
                        const local = path.getPointAtLength(comprimento * i / (quantidade + 1));
                        const pos = local.matrixTransform(paraRaiz);
                        if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
                            automaticos.push({ x: arredondar(pos.x), y: arredondar(pos.y) });
                        }
                    }
                    if (automaticos.length >= 400) break;
                }
                // Pontos azuis são calculados automaticamente, sem exibir contagem.
            } catch (erro) {
                console.warn('Falha ao gerar pontos automáticos:', erro);

            } finally {
                auxiliar.remove();
            }
        }
        mostrarAutomaticos?.addEventListener('change', redesenhar);
        async function carregarSVG(texto) {
            if (typeof desativarPrevia === 'function') desativarPrevia();
            const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
            const raiz = doc.documentElement;
            if (doc.querySelector('parsererror') || raiz.localName !== 'svg') throw new Error('SVG inválido.');
            let valores = (raiz.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
            if (valores.length !== 4 || !valores.every(Number.isFinite) || valores[2] <= 0 || valores[3] <= 0) {
                const w = Number(raiz.getAttribute('width'));
                const h = Number(raiz.getAttribute('height'));
                if (!(w > 0 && h > 0)) throw new Error('SVG precisa ter viewBox ou largura/altura numéricas.');
                valores = [0, 0, w, h];
            }
            camada.setAttribute('viewBox', valores.join(' '));
            camada.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            if (urlAtual) URL.revokeObjectURL(urlAtual);
            urlAtual = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml' }));
            imagem.src = urlAtual;
            vazio.hidden = true;
            pronto = true;
            svgFonte = texto;
            calcularAutomaticos();
            redesenhar();
        }
        inputArquivo?.addEventListener('change', async () => {
            const arquivo = inputArquivo.files?.[0];
            if (!arquivo) return;
            try { await carregarSVG(await arquivo.text()); }
            catch (erro) { pronto = false; vazio.hidden = false; vazio.textContent = erro.message; }
        });
        // Modal de edição: carrega SVG e pontos do item já salvo.
        if (prefixo === 'edit_') {
            document.querySelectorAll('.btn-abrir-modal-editar').forEach(botao => {
                botao.addEventListener('click', async () => {
                    const atual = ++versao;
                    const id = Number(botao.dataset.id);
                    pronto = false;
                    svgFonte = '';
                    automaticos = [];
                    pontos = {};
                    selecionados.clear();
                    selecionado = null;
                    personalizado.value = '';
                    inputArquivo.value = '';
                    vazio.hidden = false;
                    vazio.textContent = 'Carregando SVG...';
                    redesenhar();
                    try {
                        const [svgResp, pontosResp] = await Promise.all([
                            fetch(`/api/itens/${id}/svg`),
                            fetch(`/api/itens/${id}/pontos`)
                        ]);
                        if (!svgResp.ok || !pontosResp.ok) throw new Error('Não foi possível carregar o item.');
                        const [svgTexto, dados] = await Promise.all([svgResp.text(), pontosResp.json()]);
                        if (atual !== versao) return;
                        pontos = dados.pontos_referencia || {};
                        await carregarSVG(svgTexto);
                    } catch (erro) {
                        if (atual === versao) vazio.textContent = erro.message;
                    }
                });
            });
        }
        // Prévia do corpo e correspondência: somente para itens que NÃO são corpos.
        const painelAncoras = painel.querySelector('.ancoras-comparacao');
        const gruposCorpos = painel.querySelector('.ancoras-grupos');
        const seletorSub = painel.querySelector('.ancoras-select-sub');
        const botaoVerificar = painel.querySelector('.ancoras-verificar');
        const resultadoAncoras = painel.querySelector('.ancoras-resultado');
        const imagemCorpo = painel.querySelector('.ancoras-imagem-corpo');
        const previaSvg = painel.querySelector('.ancoras-previa-svg');
        const botaoPrevia = painel.querySelector('.ancoras-previa-btn');
        const statusPrevia = painel.querySelector('.ancoras-previa-status');
        let previaAtiva = false;
        let corpoSvgFonte = '';
        let corpoSvgId = null;
        const categoriaSelect = document.getElementById(prefixo + 'categoria_select');
        let corposDisponiveis = [];
        let corpoAtivo = null;
        let carregandoCorpos = null;
        const subcategoriasCorpo = [
            { codigo: 'Fem', nome: 'Feminino' },
            { codigo: 'Masc', nome: 'Masculino' },
            { codigo: 'N', nome: 'Neutro' }
        ];
        const tamanhosCorpo = ['P', 'M', 'G'];
        function ehCorpo() {
            return categoriaSelect?.selectedOptions?.[0]?.textContent.trim().toLowerCase() === 'corpo';
        }
        function atualizarVisibilidade() {
            const mostrar = !ehCorpo();
            painelAncoras.hidden = !mostrar;
            imagemCorpo.hidden = !mostrar || !corpoAtivo;
        }
        async function carregarCorpos() {
            if (carregandoCorpos) return carregandoCorpos;
            carregandoCorpos = (async () => {
                try {
                    const resposta = await fetch('/api/ancoras/corpos');
                    if (!resposta.ok) throw new Error(`Erro ${resposta.status} ao consultar os corpos.`);
                    const dados = await resposta.json();
                    corposDisponiveis = Array.isArray(dados.corpos) ? dados.corpos : [];
                    escolherCorpoDaSelecao();
                } catch (erro) {
                    resultadoAncoras.textContent = `Erro ao carregar corpos (${erro.message}).`;
                } finally { carregandoCorpos = null; }
            })();
            return carregandoCorpos;
        }
        function criarBotao(rotulo, ativo, disponivel, clique) {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.textContent = rotulo;
            botao.className = 'ancoras-opcao' + (ativo ? ' ativo' : '');
            botao.setAttribute('aria-pressed', String(ativo));
            botao.disabled = !disponivel;
            botao.addEventListener('click', clique);
            return botao;
        }
        function selecionarCorpo(corpo) {
            desativarPrevia();
            corpoAtivo = corpo;
            resultadoAncoras.replaceChildren();
            imagemCorpo.src = `/api/itens/${encodeURIComponent(corpo.id)}/svg`;
            imagemCorpo.hidden = ehCorpo();
            renderizarCorpos();
        }
        function escolherCorpoDaSelecao() {
            desativarPrevia();
            const sub = seletorSub?.value || 'Fem';
            const disponiveis = corposDisponiveis.filter(c =>
                String(c.subcategoria || '').trim().toLowerCase() === sub.toLowerCase()
            );
            // Cada tipo começa no P; se não estiver cadastrado, usa o primeiro tamanho disponível.
            const escolhido = disponiveis.find(c => String(c.tamanho || '').trim().toUpperCase() === 'P') ||
                tamanhosCorpo.map(t => disponiveis.find(c => String(c.tamanho || '').trim().toUpperCase() === t)).find(Boolean);
            if (escolhido) selecionarCorpo(escolhido);
            else {
                corpoAtivo = null;
                imagemCorpo.removeAttribute('src');
                imagemCorpo.hidden = true;
                resultadoAncoras.replaceChildren();
                renderizarCorpos();
            }
        }
        function renderizarCorpos() {
            gruposCorpos.replaceChildren();
            const sub = seletorSub?.value || 'Fem';
            const linha = document.createElement('div');
            linha.className = 'ancoras-tamanhos';
            for (const tamanho of tamanhosCorpo) {
                const candidatos = corposDisponiveis.filter(c =>
                    String(c.subcategoria || '').trim().toLowerCase() === sub.toLowerCase() &&
                    String(c.tamanho || '').trim().toUpperCase() === tamanho
                );
                const corpo = candidatos.find(c => String(c.id) === String(corpoAtivo?.id)) || candidatos[0];
                const botao = criarBotao(tamanho, !!corpo && String(corpo.id) === String(corpoAtivo?.id), !!corpo, () => selecionarCorpo(corpo));
                botao.title = corpo ? corpo.nome : 'Corpo não cadastrado';
                linha.append(botao);
            }
            gruposCorpos.append(linha);
        }
        seletorSub?.addEventListener('change', escolherCorpoDaSelecao);

        // Encaixe inicial por transformação de similaridade (translação + escala + rotação).
        // Esta é uma prévia não destrutiva: não modifica o SVG nem os pontos salvos.
        function viewBoxDoSvg(texto) {
            const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
            if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('SVG inválido.');
            const svg = doc.documentElement;
            const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
            if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) return vb;
            const w = Number(svg.getAttribute('width')), h = Number(svg.getAttribute('height'));
            if (w > 0 && h > 0) return [0, 0, w, h];
            throw new Error('O SVG não possui dimensões válidas.');
        }
        function calcularEncaixe(pares) {
            if (!pares.length) throw new Error('Cadastre âncoras com os mesmos nomes na roupa e no corpo.');
            const n = pares.length;
            const media = pares.reduce((a, p) => ({sx:a.sx+p.sx/n, sy:a.sy+p.sy/n, tx:a.tx+p.tx/n, ty:a.ty+p.ty/n}), {sx:0,sy:0,tx:0,ty:0});
            let aa=0, bb=0, denom=0;
            for (const p of pares) {
                const x=p.sx-media.sx, y=p.sy-media.sy, u=p.tx-media.tx, v=p.ty-media.ty;
                aa += x*u+y*v; bb += x*v-y*u; denom += x*x+y*y;
            }
            const a = n < 2 || denom < 1e-9 ? 1 : aa/denom;
            const b = n < 2 || denom < 1e-9 ? 0 : bb/denom;
            if (!Number.isFinite(a) || !Number.isFinite(b) || Math.hypot(a,b) < 0.01) throw new Error('Âncoras insuficientes ou incompatíveis para calcular o encaixe.');
            return {a,b, tx:media.tx-a*media.sx+b*media.sy, ty:media.ty-b*media.sx-a*media.sy};
        }
        function desativarPrevia() {
            previaAtiva = false;
            previaSvg.hidden = true;
            imagem.hidden = false;
            camada.hidden = false;
            if (botaoPrevia) botaoPrevia.textContent = 'Visualizar encaixe inicial';
        }
        async function ativarPrevia() {
            if (!corpoAtivo || !pronto || !svgFonte) throw new Error('Carregue uma roupa e selecione um corpo.');
            const pontosCorpo = corpoAtivo.pontos_referencia || {};
            const pares = Object.entries(pontos).filter(([nome, p]) =>
                p && pontosCorpo[nome] && [p.x,p.y,pontosCorpo[nome].x,pontosCorpo[nome].y].every(v => Number.isFinite(Number(v)))
            ).map(([nome,p]) => ({sx:Number(p.x),sy:Number(p.y),tx:Number(pontosCorpo[nome].x),ty:Number(pontosCorpo[nome].y)}));
            const transform = calcularEncaixe(pares);
            if (corpoSvgId !== corpoAtivo.id) {
                const resposta = await fetch(`/api/itens/${encodeURIComponent(corpoAtivo.id)}/svg`);
                if (!resposta.ok) throw new Error('Não foi possível carregar o SVG do corpo.');
                corpoSvgFonte = await resposta.text(); corpoSvgId = corpoAtivo.id;
            }
            const vbCorpo = viewBoxDoSvg(corpoSvgFonte), vbRoupa = viewBoxDoSvg(svgFonte);
            // Incorporar os SVGs diretamente, evitando URLs blob em <image>,
            // que podem falhar por restrições de carregamento ou referências internas.
            function incorporarSvg(texto, vb) {
                const documento = new DOMParser().parseFromString(texto, 'image/svg+xml');
                if (documento.querySelector('parsererror') || documento.documentElement.localName !== 'svg') {
                    throw new Error('Não foi possível interpretar um dos SVGs.');
                }
                const elemento = document.importNode(documento.documentElement, true);
                elemento.setAttribute('x', String(vb[0]));
                elemento.setAttribute('y', String(vb[1]));
                elemento.setAttribute('width', String(vb[2]));
                elemento.setAttribute('height', String(vb[3]));
                elemento.setAttribute('viewBox', vb.join(' '));
                elemento.setAttribute('overflow', 'visible');
                return elemento;
            }
            const fundo = incorporarSvg(corpoSvgFonte, vbCorpo);
            const grupo = document.createElementNS(NS, 'g');
            grupo.setAttribute('transform', `matrix(${transform.a} ${transform.b} ${-transform.b} ${transform.a} ${transform.tx} ${transform.ty})`);
            const roupa = incorporarSvg(svgFonte, vbRoupa);
            grupo.append(roupa);
            previaSvg.setAttribute('viewBox', vbCorpo.join(' '));
            previaSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            previaSvg.replaceChildren(fundo, grupo);
            previaSvg.hidden = false; imagem.hidden = true; camada.hidden = true;
            previaAtiva = true; botaoPrevia.textContent = 'Voltar à edição dos pontos';
            statusPrevia.textContent = `${pares.length} âncora(s) usadas no encaixe inicial. Ajustes FFD ainda não implementados.`;
        }
        botaoPrevia?.addEventListener('click', async () => {
            if (previaAtiva) { desativarPrevia(); return; }
            try { await ativarPrevia(); } catch (erro) { statusPrevia.textContent = erro.message; desativarPrevia(); }
        });

        function verificarAncoras() {
            if (!corpoAtivo) { resultadoAncoras.textContent = 'Escolha um corpo.'; return; }
            const pontosCorpo = corpoAtivo.pontos_referencia || {};
            const pares = Object.entries(pontos).filter(([chave, p]) =>
                p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) &&
                pontosCorpo[chave] && Number.isFinite(Number(pontosCorpo[chave].x)) && Number.isFinite(Number(pontosCorpo[chave].y))
            );
            resultadoAncoras.replaceChildren();
            const resumo = document.createElement('p');
            resumo.textContent = `${pares.length} âncora(s) correspondente(s) entre a roupa e ${corpoAtivo.nome}.`;
            resultadoAncoras.append(resumo);
            for (const [chave, origem] of pares) {
                const destino = pontosCorpo[chave];
                const linha = document.createElement('p');
                linha.textContent = `${chave}: roupa (${origem.x}, ${origem.y}) → corpo (${destino.x}, ${destino.y})`;
                resultadoAncoras.append(linha);
            }
            const ausentes = Object.keys(pontos).filter(chave => !pontosCorpo[chave]);
            if (ausentes.length) {
                const aviso = document.createElement('p');
                aviso.textContent = `Sem correspondente no corpo: ${ausentes.join(', ')}`;
                resultadoAncoras.append(aviso);
            }
        }
        botaoVerificar?.addEventListener('click', verificarAncoras);
        categoriaSelect?.addEventListener('change', () => { desativarPrevia(); atualizarVisibilidade(); });
        // O editor de edição recebe a categoria pelo script do CRUD; sincroniza após o clique.
        if (prefixo === 'edit_') document.querySelectorAll('.btn-abrir-modal-editar').forEach(botao =>
            botao.addEventListener('click', () => { setTimeout(atualizarVisibilidade, 0); })
        );
        atualizarVisibilidade();
        carregarCorpos();
        form.addEventListener('submit', () => atualizarJSON());
        redesenhar();
    });
});
