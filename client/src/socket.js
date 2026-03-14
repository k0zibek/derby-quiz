import { io } from "socket.io-client";

function getDefaultServerUrl() {
    if (typeof window === "undefined") {
        return "http://localhost:4000";
    }

    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:4000`;
}

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || getDefaultServerUrl();

export const socket = io(SERVER_URL, {
    autoConnect: true,
});
