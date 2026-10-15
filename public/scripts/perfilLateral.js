(() => {
  const painel = document.getElementById('perfilPainel');
  const fundo = document.getElementById('perfilFundo');
  const botao = document.querySelector('[data-abrir-perfil]');
  const fecharBotao = document.getElementById('fecharPerfil');
  if (!painel || !fundo || !fecharBotao) return;
  let focoAnterior = null;
  const fechar = () => {
    painel.classList.remove('aberto'); painel.setAttribute('aria-hidden', 'true');
    botao?.setAttribute('aria-expanded', 'false'); fundo.hidden = true;
    document.body.classList.remove('perfil-aberto');
    if (focoAnterior?.isConnected) focoAnterior.focus();
  };
  const abrir = () => {
    if (document.getElementById('carrinhoPainel')?.classList.contains('aberto')) document.getElementById('fecharCarrinho')?.click();
    focoAnterior = document.activeElement;
    painel.classList.add('aberto'); painel.setAttribute('aria-hidden', 'false');
    botao?.setAttribute('aria-expanded', 'true'); fundo.hidden = false;
    document.body.classList.add('perfil-aberto'); fecharBotao.focus();
  };
  if (new URLSearchParams(location.search).get('perfil') === 'abrir') abrir();
  document.querySelectorAll('[data-abrir-perfil]').forEach(elemento => elemento.addEventListener('click', (event) => { event.preventDefault(); painel.classList.contains('aberto') ? fechar() : abrir(); }));
  fecharBotao.addEventListener('click', fechar);
  fundo.addEventListener('click', fechar);
  document.addEventListener('keydown', e => {
    if (!painel.classList.contains('aberto')) return;
    if (e.key === 'Escape') fechar();
    if (e.key === 'Tab') {
      const elementos = [...painel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled])')].filter(el => el.getClientRects().length);
      if (!elementos.length) return;
      const primeiro = elementos[0], ultimo = elementos[elementos.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  });
})();
