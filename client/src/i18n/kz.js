export const kz = {
    appName: "Жайлау Quiz Race",
    defaultPlayerName: "Ойыншы",
    labels: {
        code: "Ойын коды",
        status: "Күйі",
        players: "Қатысушы",
        answered: "Жауап бергендер",
        question: "Сұрақ",
        points: "ұпай",
        progress: "Ілгерілеу",
        currentQuestion: "Ағымдағы сұрақ",
        raceScreen: "Жарыс экраны",
        winners: "Жеңімпаздар",
        topPlayers: "Осы сессияның үздік ойыншылары.",
        linkForPlayers: "Оқушыларға арналған сілтеме",
        linkForScreen: "Үлкен экранға арналған сілтеме",
        answerCount: "жауап",
    },
    buttons: {
        connect: "Қосылу",
        connecting: "Қосылып жатыр...",
        authorizeTeacher: "Кіру",
        startQuestion: "Сұрақты бастау",
        showResults: "Нәтижені көрсету",
        nextQuestion: "Келесі сұрақ",
        resetGame: "Ойынды қайта бастау",
        copyLink: "Сілтемені көшіру",
        copyScreen: "Экран сілтемесін көшіру",
        openScreen: "Жарыс экранын ашу",
    },
    teacher: {
        kicker: "Мұғалім панелі",
        accessTitle: "Мұғалімге кіру",
        accessSubtitle:
            "Ойын жүргізу үшін мұғалімнің PIN-кодын енгізіңіз. Оқушылар бұл бөлімге кірмеуі керек.",
        accessPlaceholder: "Мұғалім PIN-коды",
        accessHint:
            "Егер PIN-код орнатылмаған болса, сервер іске қосылған терминалда көрсетілген кодты пайдаланыңыз.",
        subtitle:
            "Оқушылар QR-кодпен кіріп, телефоннан жауап береді, ал сен бүкіл топтың нәтижесі мен жарысты бір экраннан көресің.",
        joinTitle: "Оқушыларды қосу",
        joinSubtitle: "QR-кодты экранға шығарыңыз немесе сілтемені тікелей жіберіңіз.",
        controlsTitle: "Ойынды басқару",
        controlsSubtitle: "Негізгі реті: сұрақты бастау -> нәтижені көрсету -> келесі сұрақ.",
        currentQuestionEmpty: "Сұрақ әлі белсенді емес. Барлығы жиналған соң ойынды бастаңыз.",
    },
    join: {
        entryTitle: "Ойынға кіру",
        waitingTitle: "Сәл күтіңіз",
        subtitle: "Атыңды енгізіп, сессияға қосыл. Содан кейін мұғалімнің сұрағын күт.",
        placeholder: "Мысалы: Аружан",
        restore: "Сақталған қосылым тексеріліп жатыр...",
        shortNames: "Жарыс экранында аттар әдемі көрінуі үшін қысқа ат қолданған дұрыс.",
        progressTitle: "Сенің нәтижең",
        progressSubtitle: "Дұрыс жауаптар үшін ұпай беріледі.",
        lobby: "Мұғалім әлі сұрақты бастаған жоқ. Аздап күте тұр.",
        answerSent: "Жауап жіберілді",
        answerHint: "Бір нұсқаны таңда. Жауапты тек бір рет жіберуге болады.",
        resultTitle: "Нәтиже",
        resultAccepted: "Жауабың қабылданды",
        resultHint: "Жалпы экраннан барлық аттардың орнын көре аласың.",
        finishedTitle: "Ойын аяқталды",
        finishedHint: "Мұғалім ойынды қайта бастай алады немесе жаңа сессия ашады.",
        thankYou: "Ойынға рахмет",
    },
    screen: {
        title: "Жайлау жарысы",
        empty: "Қатысушылар әлі қосылған жоқ. Оқушыларға QR-кодты көрсетіңіз.",
        currentQuestionSubtitle: "Оқушылар телефоннан жауап береді. Жарыс автоматты түрде жаңарып тұрады.",
    },
    states: {
        lobby: { text: "Лобби", className: "status-pill status-lobby" },
        question: { text: "Сұрақ жүріп жатыр", className: "status-pill status-question" },
        result: { text: "Нәтиже көрсетіліп жатыр", className: "status-pill status-result" },
        finished: { text: "Ойын аяқталды", className: "status-pill status-finished" },
    },
    answerFeedback: {
        correct: "Дұрыс",
        incorrect: "Қате",
    },
    network: {
        connecting: (serverUrl) => `Ойын серверіне қосылып жатырмыз (${serverUrl})...`,
        disconnected: (serverUrl) => `Ойын серверімен байланыс жоқ (${serverUrl}). Қайта қосылуды күтеміз.`,
        connectTimeout:
            "Ойын сервері уақытында жауап бермеді. Сервердің іске қосылғанын және жергілікті желіде қолжетімді екенін тексеріңіз.",
        connectError:
            "Ойын серверіне қосылу мүмкін болмады. Сервердің IP-мекенжайы мен портын тексеріңіз.",
        ackTimeout: "Қосылу сұрағына уақытында жауап келмеді. Қайтадан байқап көріңіз.",
        teacherAccessDenied: "Мұғалімнің PIN-коды қате.",
        unauthorized: "Сессия кілті жарамсыз немесе ескірген. Қайта кіріп көріңіз.",
        genericJoin: "Қосылу сәтсіз аяқталды",
    },
    errors: {
        enterName: "Атыңды енгіз",
        sessionNotFound: "Сессия табылмады. Ойын кодын тексер.",
        createSession: "Сессияны ашу мүмкін болмады",
        operationFailed: "Әрекет орындалмады",
        connectScreen: "Экранды қосу мүмкін болмады",
    },
    race: {
        statusText: {
            lobby: "Қатысушылар жиналып жатыр",
            question: "Сұрақ жүріп жатыр",
            result: "Сұрақтың нәтижесі",
            finished: "Финал",
        },
    },
};

export function getStatusView(status) {
    return kz.states[status] || kz.states.lobby;
}

export function getConnectionMessage(connectionState, serverUrl) {
    if (connectionState === "connecting") {
        return kz.network.connecting(serverUrl);
    }

    if (connectionState === "disconnected") {
        return kz.network.disconnected(serverUrl);
    }

    return "";
}

export function getSocketErrorMessage(response) {
    if (response?.code === "SOCKET_CONNECT_TIMEOUT") {
        return kz.network.connectTimeout;
    }

    if (response?.code === "SOCKET_CONNECT_ERROR") {
        return kz.network.connectError;
    }

    if (response?.code === "ACK_TIMEOUT") {
        return kz.network.ackTimeout;
    }

    if (response?.code === "TEACHER_ACCESS_DENIED") {
        return kz.network.teacherAccessDenied;
    }

    if (response?.code === "UNAUTHORIZED") {
        return kz.network.unauthorized;
    }

    return response?.error || kz.network.genericJoin;
}

export function getRaceStatusText(status) {
    return kz.race.statusText[status] || kz.race.statusText.lobby;
}
