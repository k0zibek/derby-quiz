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

export type PersistedPlayer = Player & {
  playerToken: string;
};

export type PersistedSession = {
  code: string;
  teacherToken: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  status: GameStatus;
  currentQuestionIndex: number;
  questions: Question[];
  players: Record<string, PersistedPlayer>;
};

export type AnswerRecord = {
  id: string;
  sessionCode: string;
  playerId: string;
  questionId: string;
  questionIndex: number;
  optionIndex: number;
  isCorrect: boolean;
  points: number;
  answeredAt: number;
};

export type QuestionSet = {
  id: string;
  title: string;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
};

export type QuestionSetSummary = {
  id: string;
  title: string;
  questionCount: number;
  createdAt: number;
  updatedAt: number;
};

export type TextQuestionDraft = {
  id?: string | undefined;
  stem: string;
  options: string[];
  correctIndex: number;
};

export type QuestionSetDraft = {
  id?: string | undefined;
  title: string;
  questions: TextQuestionDraft[];
};

export type RuntimeSessionSnapshot = PersistedSession;

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

export type QuestionSetListAck = AckResponse<{
  questionSets: QuestionSetSummary[];
}>;

export type QuestionSetAck = AckResponse<{
  questionSet: QuestionSet;
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
    payload: { accessPin?: string; questionSetId?: string },
    callback?: (response: TeacherCreateSessionAck) => void
  ) => void;
  "questionSet:list": (
    payload: { accessPin?: string },
    callback?: (response: QuestionSetListAck) => void
  ) => void;
  "questionSet:create": (
    payload: { accessPin?: string; questionSet: QuestionSetDraft },
    callback?: (response: QuestionSetAck) => void
  ) => void;
  "questionSet:get": (
    payload: { accessPin?: string; questionSetId: string },
    callback?: (response: QuestionSetAck) => void
  ) => void;
  "questionSet:update": (
    payload: { accessPin?: string; questionSetId: string; questionSet: QuestionSetDraft },
    callback?: (response: QuestionSetAck) => void
  ) => void;
  "questionSet:delete": (
    payload: { accessPin?: string; questionSetId: string },
    callback?: (response: SimpleAck) => void
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
  "session:addQuestion": (
    payload: { code: string; teacherToken: string; question: TextQuestionDraft },
    callback?: (response: SimpleAck) => void
  ) => void;
};

export type ServerToClientEvents = {
  "session:state": (state: SessionState) => void;
};
