export type GameStatus = "lobby" | "question" | "result" | "finished";
export type QuestionType = "mcq" | "reading_mcq" | "image_mcq";
export type ConnectionState = "connected" | "connecting" | "disconnected";

export type SourceMeta = {
  section: string | null;
  itemNumber: string | null;
  source: string | null;
};

export type QuestionOption = {
  label: string;
  text: string | null;
  image: string | null;
};

export type Question = {
  id: string;
  type: QuestionType;
  stem: string | null;
  passageTitle: string | null;
  passage: string | null;
  image: string | null;
  options: QuestionOption[];
  correctIndex: number;
  groupId: string | null;
  sourceMeta: SourceMeta | null;
};

export type PublicQuestion = Omit<Question, "correctIndex">;
export type TeacherQuestion = PublicQuestion & Pick<Question, "correctIndex">;

export type Player = {
  id: string;
  name: string;
  score: number;
  progress: number;
  color: string;
  connected: boolean;
  answeredCurrent: boolean;
  selectedOption: number | null;
  lastAnswerCorrect: boolean | null;
  joinedAt: number;
};

export type TeacherState = {
  role: "teacher";
  code: string;
  status: GameStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: TeacherQuestion | null;
  players: Player[];
  answeredCount: number;
  totalPlayers: number;
  optionStats: {
    index: number;
    option: QuestionOption;
    count: number;
    isCorrect: boolean;
  }[];
  canStart: boolean;
  canShowResults: boolean;
  canGoNext: boolean;
  canReset: boolean;
};

export type PlayerState = {
  role: "player";
  code: string;
  status: GameStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: PublicQuestion | null;
  player: Player | null;
};

export type ScreenState = {
  role: "screen";
  code: string;
  status: GameStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: PublicQuestion | null;
  players: Player[];
  answeredCount: number;
  totalPlayers: number;
};

export type SessionState = TeacherState | PlayerState | ScreenState;

export type OkResponse<T extends object = object> = { ok: true } & T;
export type ErrorResponse = {
  ok: false;
  code: string;
  error: string;
};
export type AckResponse<T extends object = object> = OkResponse<T> | ErrorResponse;

export type TeacherCreateSessionAck = AckResponse<{
  code: string;
  teacherToken: string;
}>;

export type PlayerJoinAck = AckResponse<{
  playerId: string;
  playerToken: string;
}>;

export type PlayerRejoinAck = AckResponse<{
  playerId: string;
  state: PlayerState;
}>;

export type SubmitAnswerAck = AckResponse<{
  isCorrect: boolean;
  points: number;
  totalScore: number;
  progress: number;
}>;

export type NextQuestionAck = AckResponse<{
  finished: boolean;
}>;

export type SimpleAck = AckResponse;

export type ClientToServerEvents = {
  "teacher:createSession": (
    payload: { accessPin?: string },
    callback?: (response: TeacherCreateSessionAck) => void
  ) => void;
  "teacher:joinSession": (
    payload: { code: string; teacherToken: string },
    callback?: (response: SimpleAck) => void
  ) => void;
  "screen:join": (payload: { code: string }, callback?: (response: SimpleAck) => void) => void;
  "player:join": (
    payload: { code: string; name: string },
    callback?: (response: PlayerJoinAck) => void
  ) => void;
  "player:rejoin": (
    payload: { code: string; playerId: string; playerToken: string },
    callback?: (response: PlayerRejoinAck) => void
  ) => void;
  "teacher:startQuestion": (
    payload: { code: string; teacherToken: string },
    callback?: (response: SimpleAck) => void
  ) => void;
  "player:submitAnswer": (
    payload: { code: string; playerId: string; playerToken: string; optionIndex: number },
    callback?: (response: SubmitAnswerAck) => void
  ) => void;
  "teacher:showResults": (
    payload: { code: string; teacherToken: string },
    callback?: (response: SimpleAck) => void
  ) => void;
  "teacher:nextQuestion": (
    payload: { code: string; teacherToken: string },
    callback?: (response: NextQuestionAck) => void
  ) => void;
  "teacher:resetGame": (
    payload: { code: string; teacherToken: string },
    callback?: (response: SimpleAck) => void
  ) => void;
};

export type ServerToClientEvents = {
  "session:state": (state: SessionState) => void;
};
