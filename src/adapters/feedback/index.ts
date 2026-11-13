import type { Adapter } from "../../core/types";
import { adapters as emptyState } from "./empty-state";
import { adapters as loader } from "./loader";
import { adapters as meter } from "./meter";
import { adapters as notFound } from "./not-found";
import { adapters as progress } from "./progress";
import { adapters as skeleton } from "./skeleton";

/** Feedback group: loaders, skeletons, progress, meters, empty and not-found states. */
export const adapters: Adapter[] = [...loader, ...skeleton, ...progress, ...meter, ...emptyState, ...notFound];
