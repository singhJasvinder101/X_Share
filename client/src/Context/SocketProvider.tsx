"use client"


import { FC, ReactNode, createContext, useContext, useMemo } from "react"
import { Socket, io } from "socket.io-client"


const SocketContext = createContext<Socket | null>(null)

export const SocketProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const socket = useMemo(() => io("localhost:8000"), []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
}

export const useSocket = () => {
    const socket = useContext(SocketContext)
    return socket
}







