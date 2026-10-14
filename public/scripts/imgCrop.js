
let cropperCadastro = null;
let cropperEdicao = null;

const cropperOptions = {
    aspectRatio: 122 / 110,
    viewMode: 2,
    dragMode: "crop",
    autoCropArea: 1,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false
};

function configurarCropper(inputId, previewId, containerId, tipo) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const container = document.getElementById(containerId);

    if (!input || !preview || !container) return;

    input.addEventListener("change", evento => {
        const arquivo = evento.target.files?.[0];

        if (!arquivo) return;

        if (arquivo.type !== "image/svg+xml" ||
            !arquivo.name.toLowerCase().endsWith(".svg")) {
            alert("Selecione um arquivo SVG.");
            input.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const cropperAnterior = tipo === "cadastro"
                ? cropperCadastro
                : cropperEdicao;

            if (cropperAnterior) {
                cropperAnterior.destroy();
            }

            preview.onload = () => {
                container.style.display = "block";

                const novoCropper = new Cropper(
                    preview,
                    cropperOptions
                );

                if (tipo === "cadastro") {
                    cropperCadastro = novoCropper;
                } else {
                    cropperEdicao = novoCropper;
                }
            };

            preview.src = reader.result;
        };

        reader.readAsDataURL(arquivo);
    });
}

configurarCropper(
    "imagemInput",
    "imagePreview",
    "containerCropper",
    "cadastro"
);

configurarCropper(
    "edit_imagemInput",
    "edit_imagePreview",
    "edit_containerCropper",
    "edicao"
);

function configurarEnvio(formId, inputId, tipo) {
    const formulario = document.getElementById(formId);
    const inputProcessado = document.getElementById(inputId);

    if (!formulario || !inputProcessado) return;

    formulario.addEventListener("submit", evento => {
        const cropper = tipo === "cadastro"
            ? cropperCadastro
            : cropperEdicao;

        if (!cropper) return;

        evento.preventDefault();

        const canvas = cropper.getCroppedCanvas({
            width: 268,
            height: 276
        });

        if (!canvas) {
            alert("Não foi possível gerar a miniatura.");
            return;
        }

        inputProcessado.value = canvas.toDataURL("image/png");

        // O SVG original permanece no input file.
        HTMLFormElement.prototype.submit.call(formulario);
    });
}

configurarEnvio(
    "formCadastrarItem",
    "imagemProcessada",
    "cadastro"
);

configurarEnvio(
    "formEditarItem",
    "edit_imagemProcessada",
    "edicao"
);
