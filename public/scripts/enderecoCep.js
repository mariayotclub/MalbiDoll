document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.endereco-form').forEach(form => {
        const campo = nome => form.querySelector(`[name="${nome}"]`);
        const cep = campo('cep');
        if (!cep) return;
        cep.setAttribute('inputmode', 'numeric');
        cep.setAttribute('maxlength', '9');
        const aviso = document.createElement('small');
        aviso.setAttribute('aria-live', 'polite');
        cep.after(aviso);
        cep.addEventListener('blur', async () => {
            const codigo = cep.value.replace(/\D/g, '');
            if (codigo.length !== 8) {
                aviso.textContent = 'Informe um CEP com 8 dígitos.';
                return;
            }
            cep.value = `${codigo.slice(0, 5)}-${codigo.slice(5)}`;
            aviso.textContent = 'Buscando CEP...';
            try {
                const resposta = await fetch(`https://viacep.com.br/ws/${codigo}/json/`);
                if (!resposta.ok) throw new Error('Consulta indisponível');
                const dados = await resposta.json();
                if (dados.erro) throw new Error('CEP não encontrado');
                for (const [nome, valor] of Object.entries({
                    logradouro: dados.logradouro,
                    bairro: dados.bairro,
                    cidade: dados.localidade,
                    estado: dados.uf
                })) {
                    if (campo(nome) && valor) campo(nome).value = valor;
                }
                aviso.textContent = 'Endereço localizado. Confira o número e os demais campos.';
            } catch (erro) {
                aviso.textContent = 'Não foi possível consultar o CEP. Preencha manualmente.';
            }
        });
        form.addEventListener('submit', evento => {
            const obrigatorios = ['destinatario', 'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'estado'];
            const incompleto = obrigatorios.some(nome => !campo(nome)?.value.trim());
            if (incompleto || !/^\d{5}-?\d{3}$/.test(cep.value)) {
                evento.preventDefault();
                aviso.textContent = 'Confira todos os campos obrigatórios e o CEP.';
            }
        });
    });
});
