import { createHashHistory, createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  const history = createHashHistory();

  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreloadStaleTime: 0,
  });

  return router;
};
