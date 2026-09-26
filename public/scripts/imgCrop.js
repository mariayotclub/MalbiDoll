let cropper = null;
const imagemInput = document.getElementById('imagemInput');
const imagePreview = document.getElementById('imagePreview');
const containerCropper = document.getElementById('containerCropper');
const inputImagemProcessada = document.getElementById('imagemProcessada');
const formCadastrarItem = document.getElementById('formCadastrarItem');

if (imagemInput) {
    imagemInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();

            reader.onload = function (event) {
                imagePreview.src = event.target.result;
                containerCropper.style.display = 'block';

                if (cropper) {
                    cropper.destroy();
                }

                // Proporção ajustada para tangenciar perfeitamente as bordas internas sem folgas
                cropper = new Cropper(imagePreview, {
                    aspectRatio: 122 / 110, // Proporção exata da nova bordinha do card
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
                });
            };

            reader.readAsDataURL(file);
        }
    });
}

if (formCadastrarItem) {
    formCadastrarItem.addEventListener('submit', function (e) {
        if (cropper) {
            e.preventDefault();

            const canvas = cropper.getCroppedCanvas({
                width: 268,
                height: 276
            });

            const croppedDataUrl = canvas.toDataURL('image/png');
            inputImagemProcessada.value = croppedDataUrl;

            formCadastrarItem.submit();
        }
    });
}