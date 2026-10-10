// Variáveis do Cropper para o Cadastro
let cropperCadastro = null;
const imagemInput = document.getElementById('imagemInput');
const imagePreview = document.getElementById('imagePreview');
const containerCropper = document.getElementById('containerCropper');
const inputImagemProcessada = document.getElementById('imagemProcessada');
const formCadastrarItem = document.getElementById('formCadastrarItem');

// Variáveis do Cropper para a Edição
let cropperEdicao = null;
const editImagemInput = document.getElementById('edit_imagemInput');
const editImagePreview = document.getElementById('edit_imagePreview');
const editContainerCropper = document.getElementById('edit_containerCropper');
const editInputImagemProcessada = document.getElementById('edit_imagemProcessada');
const formEditarItem = document.getElementById('formEditarItem');

// Configuração padrão do Cropper (proporção exata da bordinha do card)
const cropperOptions = {
    aspectRatio: 122 / 110,
    viewMode: 2,
    dragMode: 'crop',
    autoCropArea: 1,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
};

// ==========================================
// 1. LÓGICA DE CROPPER PARA O MODAL DE CADASTRO
// ==========================================
if (imagemInput) {
    imagemInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();

            reader.onload = function (event) {
                imagePreview.src = event.target.result;
                containerCropper.style.display = 'block';

                if (cropperCadastro) {
                    cropperCadastro.destroy();
                }

                cropperCadastro = new Cropper(imagePreview, cropperOptions);
            };

            reader.readAsDataURL(file);
        }
    });
}

if (formCadastrarItem) {
    formCadastrarItem.addEventListener('submit', function (e) {
        if (cropperCadastro) {
            e.preventDefault();

            const canvas = cropperCadastro.getCroppedCanvas({
                width: 268,
                height: 276
            });

            const croppedDataUrl = canvas.toDataURL('image/png');
            inputImagemProcessada.value = croppedDataUrl;

            formCadastrarItem.submit();
        }
    });
}

// ==========================================
// 2. LÓGICA DE CROPPER PARA O MODAL DE EDIÇÃO
// ==========================================
if (editImagemInput) {
    editImagemInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();

            reader.onload = function (event) {
                editImagePreview.src = event.target.result;
                editContainerCropper.style.display = 'block';

                if (cropperEdicao) {
                    cropperEdicao.destroy();
                }

                cropperEdicao = new Cropper(editImagePreview, cropperOptions);
            };

            reader.readAsDataURL(file);
        }
    });
}

if (formEditarItem) {
    formEditarItem.addEventListener('submit', function (e) {
        // Só intercepta e recorta se o usuário tiver feito upload de uma nova imagem no modal de edição
        if (cropperEdicao) {
            e.preventDefault();

            const canvas = cropperEdicao.getCroppedCanvas({
                width: 268,
                height: 276
            });

            const croppedDataUrl = canvas.toDataURL('image/png');
            editInputImagemProcessada.value = croppedDataUrl;

            formEditarItem.submit();
        }
    });
}