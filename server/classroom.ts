import os from "node:os";

export type ClassroomInfo = {
    port: number;
    localUrl: string;
    networkUrls: string[];
    teacherUrl: string;
    screenUrlTemplate: string;
    joinUrlTemplate: string;
    teacherAccessPin: string;
};

export function getLanAddresses(): string[] {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter((address): address is NonNullable<typeof address> =>
            Boolean(address && address.family === "IPv4" && !address.internal)
        )
        .map((address) => address.address);
}

export function buildClassroomInfo({ port, teacherAccessPin }: { port: number; teacherAccessPin: string }): ClassroomInfo {
    const localUrl = `http://localhost:${port}`;
    const networkUrls = getLanAddresses().map((address) => `http://${address}:${port}`);
    const primaryUrl = networkUrls[0] ?? localUrl;

    return {
        port,
        localUrl,
        networkUrls,
        teacherUrl: `${primaryUrl}/teacher`,
        screenUrlTemplate: `${primaryUrl}/screen/{code}`,
        joinUrlTemplate: `${primaryUrl}/join/{code}`,
        teacherAccessPin,
    };
}

export function printClassroomInfo(info: ClassroomInfo): void {
    console.log(`Server running on ${info.localUrl}`);
    for (const networkUrl of info.networkUrls) {
        console.log(`Network URL: ${networkUrl}`);
    }
    console.log(`Teacher URL: ${info.teacherUrl}`);
    console.log(`Screen URL: ${info.screenUrlTemplate}`);
    console.log(`Join URL: ${info.joinUrlTemplate}`);
    console.log(`Teacher access PIN: ${info.teacherAccessPin}`);
}
