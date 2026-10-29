document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modalExcluirConta');
    const abrir = document.querySelector('[data-abrir-exclusao-conta]');
    const fechar = modal?.querySelector('[data-fechar-exclusao-conta]');
    const formulario = document.getElementById('formExcluirConta');

    if (!modal || !abrir || !fechar || !formulario) return;

    const campoSenha = formulario.querySelector('[name="senha_confirmacao"]');

    function fecharModal() {
        modal.hidden = true;
        formulario.reset();
        abrir.focus();
    }

    abrir.addEventListener('click', () => {
        modal.hidden = false;
        campoSenha.focus();
    });

    fechar.addEventListener('click', fecharModal);

    modal.addEventListener('click', (evento) => {
        if (evento.target === modal) fecharModal();
    });

    modal.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') fecharModal();

        if (evento.key === 'Tab') {
            const elementos = [...modal.querySelectorAll(
                'input:not([disabled]), button:not([disabled])'
            )];
            const primeiro = elementos[0];
            const ultimo = elementos[elementos.length - 1];

            if (evento.shiftKey && document.activeElement === primeiro) {
                evento.preventDefault();
                ultimo.focus();
            } else if (!evento.shiftKey && document.activeElement === ultimo) {
                evento.preventDefault();
                primeiro.focus();
            }
        }
    });
});
