const modalEnvio = document.getElementById('modalConfirmarEnvio');
let formularioEnvio = null;

for (const formulario of document.querySelectorAll('.etapas-form')) {
    const caixas = [...formulario.querySelectorAll('[data-etapa]')];
    const campo = formulario.elements.etapa;

    function atualizar() {
        const marcadas = caixas.filter(caixa => caixa.checked).length;
        campo.value = String(marcadas);
        caixas.forEach((caixa, indice) => {
            caixa.disabled = indice > marcadas;
        });
    }

    caixas.forEach(caixa => caixa.addEventListener('change', () => {
        const indice = Number(caixa.dataset.etapa);
        if (caixa.checked) {
            caixas.forEach(item => {
                if (Number(item.dataset.etapa) < indice) item.checked = true;
            });
        } else {
            caixas.forEach(item => {
                if (Number(item.dataset.etapa) > indice) item.checked = false;
            });
        }
        atualizar();
    }));

    formulario.addEventListener('submit', evento => {
        const proxima = Number(campo.value);
        if (proxima === caixas.length) {
            evento.preventDefault();
            formularioEnvio = formulario;
            modalEnvio.hidden = false;
        }
    });
}

document.getElementById('cancelarEnvio').addEventListener('click', () => {
    modalEnvio.hidden = true;
    formularioEnvio = null;
});

document.getElementById('confirmarEnvio').addEventListener('click', () => {
    if (!formularioEnvio) return;
    formularioEnvio.elements.confirmar_envio.value = 'sim';
    formularioEnvio.submit();
});
