import type { ParentComponent } from "solid-js";
import { Suspense } from "solid-js";
import MainLayout from "./layouts/main";

const App: ParentComponent = (props) => {
  return (
    <MainLayout>
      <Suspense fallback={<div>Loading...</div>}>{props.children}</Suspense>
    </MainLayout>
  );
};

export default App;
