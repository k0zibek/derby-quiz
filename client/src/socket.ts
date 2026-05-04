import { io, type Socket } from "socket.io-client";

import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function getDefaultServerUrl(): string {
    if (typeof window === "undefined") {
        return "http://localhost:4000";
    }

    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:4000`;
}

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL || getDefaultServerUrl();

export const socket: GameSocket = io(SERVER_URL, {
    autoConnect: true,
});
