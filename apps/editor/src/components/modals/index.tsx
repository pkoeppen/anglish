import EditLemmaModal from "./EditLemmaModal";
import EditSenseModal from "./EditSenseModal";
import { createModalSystem } from "./system";

const { ModalProvider, useModal } = createModalSystem({
  editSenseModal: EditSenseModal,
  editLemmaModal: EditLemmaModal,
});

export { ModalProvider, useModal };
