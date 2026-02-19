/* eslint-disable react-refresh/only-export-components */
import type { ReactElement } from "react";
import { render, cleanup, type RenderOptions } from "@testing-library/react";
import { Provider } from "./components/ui/provider";
import { BrowserRouter } from "react-router-dom";

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  withRouter?: boolean;
}

function Wrapper({
  children,
  withRouter,
}: {
  children: React.ReactNode;
  withRouter?: boolean;
}) {
  const content = <Provider>{children}</Provider>;
  return withRouter ? <BrowserRouter>{content}</BrowserRouter> : content;
}

function customRender(ui: ReactElement, options?: CustomRenderOptions) {
  const { withRouter = false, ...renderOptions } = options || {};
  cleanup();
  return render(ui, {
    wrapper: ({ children }) => (
      <Wrapper withRouter={withRouter}>{children}</Wrapper>
    ),
    ...renderOptions,
  });
}

export * from "@testing-library/react";
export { customRender as render };
