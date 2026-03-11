import type { ParentComponent } from "solid-js";

const MainLayout: ParentComponent = (props) => {
  return (
    <div class="flex bg-white">
      <main class="grow">{props.children}</main>
    </div>
  );
};

export default MainLayout;
