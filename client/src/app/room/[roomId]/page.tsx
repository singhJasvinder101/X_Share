"use client"
import { useWebRTC } from '@/Context/RTCProvider'
import { useSocket } from '@/Context/SocketProvider'
import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import peer from '@/services/peer'

const page = () => {
    const socket = useSocket()
    const fileRef = useRef()
    const [remoteSocketId, setRemoteSocketId] = useState<string | null>()
    const [remoteUser, setRemoteUser] = useState<string | null>()
    const [isNegotiationNeeded, setIsNegotiationNeeded] = useState<boolean | null>(false);

    const handleRoomJoined = (data: any) => {
        console.log(`NameId ${data.nameId} joined room`);
        setRemoteSocketId(data.id);
        setRemoteUser(data.nameId);
    };


    const handleCallUser = useCallback(async () => {
        const offer = await peer.getOffer();
        socket?.emit("user:call", { to: remoteSocketId, offer });
    }, [remoteSocketId, socket])


    const handleIncomingCall = useCallback(async (data: any) => {
        const { from, offer, nameId } = data;

        const ans = await peer.getAnswer(offer)
        setRemoteUser(nameId)
        // jisse call aayi usse bhejdo
        socket?.emit('call:accepted', { to: from, ans })
    }, [socket])


    const handleCallAccepted = useCallback(async (data: any) => {
        const { ans } = data;
        await peer.setLocalDescription(ans)
        console.log("call accepted");
    }, [])


    const handleNegoNeeded = useCallback(async () => {
        console.log("negotiation triggered")
        const offer = await peer.getOffer();
        socket?.emit("peer:nego:needed", { offer, to: remoteSocketId });
    }, [remoteSocketId, socket]);

    useEffect(() => {
        peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
        return () => {
            peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
        };
    }, [handleNegoNeeded]);

    const handleNegoNeedIncomming = useCallback(
        async (data: any) => {
            const { from, offer } = data
            const ans = await peer.getAnswer(offer);
            socket?.emit("peer:nego:done", { to: from, ans });
        },
        [socket]
    );

    const handleNegoNeedFinal = useCallback(async (data: any) => {
        const { ans } = data
        await peer.setLocalDescription(ans);
    }, []);



    const handleFileChange = (e: any) => {
        fileRef.current = e.target.files[0]
    }

    type FileMetadata = {
        name: string;
        size: number;
        type: string;
    };

    const handleSendFile = async () => {
        if (fileRef.current && peer.fileChannel) {
            console.log(peer)
            const file: File = fileRef.current;
            console.log(peer.fileChannel)

            // Reading the entire file as an ArrayBuffer
            const arrayBuffer: ArrayBuffer = await readFileAsArrayBuffer(file);
            const metadata: FileMetadata = {
                name: file.name,
                size: file.size,
                type: file.type,
            };

            if (peer.fileChannel.readyState === 'open') {
                console.log("hello")
                peer.fileChannel.send(JSON.stringify(metadata));

                const chunkSize = 16 * 1024; // 16 KB chunks
                for (let offset = 0; offset < arrayBuffer.byteLength; offset += chunkSize) {
                    const chunk = arrayBuffer.slice(offset, offset + chunkSize);

                    if (peer.fileChannel.readyState === 'open') {
                        peer.fileChannel.send(chunk);
                    } else {
                        console.log('RTCDataChannel not in open state when sending chunk.');
                    }
                }
            } else {
                console.log('RTCDataChannel not in open state');
            }
        }
    };

    const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                if (e.target && e.target.result && e.target.result instanceof ArrayBuffer) {
                    resolve(e.target.result);
                } else {
                    reject(new Error('Failed to read file as ArrayBuffer.'));
                }
            };

            reader.onerror = (error) => {
                reject(error);
            };

            reader.readAsArrayBuffer(file);
        });
    };

    const handleReceiveFile = async (data: any) => {
        const { metadata, chunks } = data;

        const receivedChunks: ArrayBuffer[] = [];
        for (const chunk of chunks) {
            receivedChunks.push(new Uint8Array(chunk).buffer);
        }

        const fileData = new Blob(receivedChunks, { type: metadata.type });
        const downloadLink = URL.createObjectURL(fileData);

        console.log(`Received file: ${metadata.name}`);
        console.log(`Size: ${metadata.size} bytes`);
        console.log(`Type: ${metadata.type}`);

        // Example: Create a download link in your UI
        const downloadButton = document.createElement('a');
        downloadButton.href = downloadLink;
        downloadButton.download = metadata.name;
        downloadButton.textContent = 'Download File';
        document.body.appendChild(downloadButton);
    };

    useEffect(() => {
        console.log(peer.fileChannel?.readyState)
        // Listen for file data on the fileChannel
        peer.fileChannel?.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);

            if (data.metadata && data.chunks) {
                handleReceiveFile(data);
            }
        });

        return () => {
            peer.fileChannel?.removeEventListener('message', handleReceiveFile);
        };
    }, [peer.fileChannel]);


    useEffect(() => {
        if (typeof window !== undefined && window.RTCPeerConnection) {
            socket?.on('user:joined', handleRoomJoined)
            socket?.on("incoming:call", handleIncomingCall);
            socket?.on("call:accepted", handleCallAccepted);
            socket?.on("peer:nego:needed", handleNegoNeedIncomming);
            socket?.on("peer:nego:final", handleNegoNeedFinal);
            return () => {
                socket?.off("user:joined", handleRoomJoined);
                socket?.off("incoming:call", handleIncomingCall);
                socket?.off("call:accepted", handleCallAccepted);
                socket?.off("peer:nego:needed", handleNegoNeedIncomming);
                socket?.off("peer:nego:final", handleNegoNeedFinal);
            }
        }

    }, [
        socket,
        handleRoomJoined,
        handleIncomingCall,
        handleCallAccepted,
        handleNegoNeedIncomming,
        handleNegoNeedFinal,

    ])


    return (
        <div>
            <h1>Room Page</h1>
            <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
            <h4>connection with {remoteUser}</h4>
            <input type="file" onChange={handleFileChange} />
            <button onClick={handleSendFile}>Send File</button>
            {remoteSocketId && <button onClick={handleCallUser}>CALL</button>}
        </div>
    )
}

export default page