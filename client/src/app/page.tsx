"use client"

import { useWebRTC } from "@/Context/RTCProvider";
import { useSocket } from "@/Context/SocketProvider";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function Home() {
  const socket = useSocket();
  const [nameId, setNameId] = useState("")
  const [room, setRoom] = useState("")
  const router = useRouter()

  const handleSubmit = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    socket?.emit('room:join', { nameId, room })
  }, [socket, nameId, room])

  const handleJoinedRoom = useCallback(async (data: any) => {
    const { nameId, room } = data;
    console.log(`Joined room. Socket name: ${nameId}, id: ${room}`);

    router.push('/room/' + room)
  }, [socket, router])


  useEffect(() => {
    socket?.on("room:join", handleJoinedRoom);
    return () => {
      socket?.off("room:join", handleJoinedRoom);
    };
  }, [socket, handleJoinedRoom]);


  return (
    <main>
      <form>
        <div className="form">
          <div className="name">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              className=""
              id="name"
              value={nameId}
              onChange={(e) => setNameId(e.target.value)}
            />
          </div>
          <div className="room">
            <label htmlFor="room">Room</label>
            <input
              type="text"
              id="room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>
          <button onClick={handleSubmit}>Join</button>
        </div>
      </form>
    </main>
  );
}
