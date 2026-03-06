import type { ParentComponent } from "solid-js";
import Sidebar from "./components/Sidebar";

const MainLayout: ParentComponent = (props) => {
  return (
    <div class="flex bg-white">
      <Sidebar />
      <main class="pl-64 grow">{props.children}</main>
    </div>
  );
};

export default MainLayout;
