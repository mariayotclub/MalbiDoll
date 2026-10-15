document.querySelectorAll('[data-editor-cores]').forEach(editor => {
    const campo = editor.querySelector('input[name="cores"]');
    const seletor = editor.querySelector('input[type="color"]');
    const lista = editor.querySelector('.editor-cores-lista');
    let cores = [];
    function renderizar() {
        campo.value = JSON.stringify(cores);
        lista.replaceChildren();
        cores.forEach((cor, indice) => {
            const linha = document.createElement('div');
            linha.className = 'editor-cor-linha';
            const amostra = document.createElement('input');
            amostra.type = 'color'; amostra.value = cor;
            amostra.addEventListener('input', () => { cores[indice] = amostra.value; renderizar(); });
            const codigo = document.createElement('span'); codigo.textContent = cor;
            const excluir = document.createElement('button'); excluir.type = 'button';
            excluir.textContent = 'Remover';
            excluir.addEventListener('click', () => { cores.splice(indice, 1); renderizar(); });
            linha.append(amostra, codigo, excluir); lista.append(linha);
        });
    }
    editor.querySelector('[data-adicionar-cor]').addEventListener('click', () => {
        if (cores.length >= 40) return;
        cores.push(seletor.value); renderizar();
    });
    if (editor.closest('#modalEditarItem')) {
        window.addEventListener('malbi:editar-cores', evento => {
            try { const valor = JSON.parse(evento.detail.cores); cores = Array.isArray(valor) ? valor : []; }
            catch { cores = []; }
            renderizar();
        });
    }
    renderizar();
});
