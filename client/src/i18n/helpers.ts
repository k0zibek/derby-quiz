import type {
  AckResponse,
  ConnectionState,
  GameStatus,
} from "../../../shared/types";
import type { AppMessages } from "./types";

export function getStatusView(
  status: GameStatus | undefined,
  copy: AppMessages,
) {
  return status ? copy.states[status] : copy.states.lobby;
}

export function getConnectionMessage(
  connectionState: ConnectionState,
  serverUrl: string,
  copy: AppMessages,
): string {
  if (connectionState === "connecting") {
    return copy.network.connecting(serverUrl);
  }

  if (connectionState === "disconnected") {
    return copy.network.disconnected(serverUrl);
  }

  return "";
}

export function getSocketErrorMessage(
  response: AckResponse | undefined,
  copy: AppMessages,
): string {
  if (!response || response.ok) {
    return copy.network.genericJoin;
  }

  if (response.code === "SOCKET_CONNECT_TIMEOUT") {
    return copy.network.connectTimeout;
  }

  if (response.code === "SOCKET_CONNECT_ERROR") {
    return copy.network.connectError;
  }

  if (response.code === "ACK_TIMEOUT") {
    return copy.network.ackTimeout;
  }

  if (response.code === "TEACHER_ACCESS_DENIED") {
    return copy.network.teacherAccessDenied;
  }

  if (response.code === "UNAUTHORIZED") {
    return copy.network.unauthorized;
  }

  return response.error || copy.network.genericJoin;
}

export function getRaceStatusText(
  status: GameStatus | undefined,
  copy: AppMessages,
): string {
  return status ? copy.race.statusText[status] : copy.race.statusText.lobby;
}
