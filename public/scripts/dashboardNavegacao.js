// A navegação completa permanece sempre visível nas páginas administrativas de desktop.
// Em telas menores e no editor, o usuário pode ocultar a lista temporariamente.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.dashboard-menu').forEach(menu => {
    const botao = menu.querySelector('.dashboard-menu-toggle');
    const links = menu.querySelector('.dashboard-menu-links');
    const texto = menu.querySelector('.dashboard-menu-toggle-texto');

    if (!botao || !links || !texto) return;

    botao.addEventListener('click', () => {
      const fechado = menu.classList.toggle('dashboard-menu-fechado');

      botao.setAttribute('aria-expanded', String(!fechado));
      botao.setAttribute(
        'aria-label',
        fechado ? 'Mostrar categorias administrativas' : 'Ocultar categorias administrativas'
      );
      texto.textContent = fechado ? 'Mostrar menu' : 'Ocultar';
    });
  });
});
