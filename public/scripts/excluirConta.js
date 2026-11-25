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

// Os modais de edição reutilizam o componente e os estilos de confirmação existentes.
document.addEventListener('DOMContentLoaded', () => {
    const modais = {
        dados: document.getElementById('modalEditarDados'),
        senha: document.getElementById('modalAlterarSenha'),
        foto: document.getElementById('modalEditarFoto')
    };
    let origem = null;

    function fechar(modal) {
        if (!modal) return;
        modal.hidden = true;
        if (modal === modais.senha || modal === modais.foto) modal.querySelector('form')?.reset();
        origem?.focus();
    }

    document.querySelectorAll('[data-abrir-modal-perfil]').forEach(botao => {
        botao.addEventListener('click', () => {
            const modal = modais[botao.dataset.abrirModalPerfil];
            if (!modal) return;
            origem = botao;
            modal.hidden = false;
            modal.querySelector('input:not([type="hidden"])')?.focus();
        });
    });

    Object.values(modais).forEach(modal => {
        if (!modal) return;
        modal.querySelector('[data-fechar-modal-perfil]')?.addEventListener('click', () => fechar(modal));
        modal.addEventListener('click', evento => {
            if (evento.target === modal) fechar(modal);
        });
        modal.addEventListener('keydown', evento => {
            if (evento.key === 'Escape') {
                evento.preventDefault();
                evento.stopPropagation();
                fechar(modal);
            }
            if (evento.key !== 'Tab') return;
            const focaveis = [...modal.querySelectorAll('input:not([type="hidden"]), button:not([disabled])')];
            const primeiro = focaveis[0];
            const ultimo = focaveis[focaveis.length - 1];
            if (evento.shiftKey && document.activeElement === primeiro) {
                evento.preventDefault();
                ultimo.focus();
            } else if (!evento.shiftKey && document.activeElement === ultimo) {
                evento.preventDefault();
                primeiro.focus();
            }
        });
    });
});
