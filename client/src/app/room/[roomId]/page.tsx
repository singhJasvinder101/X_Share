"use client"
import { useWebRTC } from '@/Context/RTCProvider'
import { useSocket } from '@/Context/SocketProvider'
import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import peer from '@/services/peer'

const page = () => {
    const socket = useSocket()
    const fileRef = useRef()
    const [remoteSocketId, setRemoteSocketId] = useState(null);
    const [remoteUser, setRemoteUser] = useState<string | null>()
    const [downloadLink, setDownloadLink] = useState<string | null>(null);
    const [receivedChunks, setReceivedChunks] = useState<{ metadata: FileMetadata | null; chunks: ArrayBuffer[] } | null>(null);

    const handleRoomJoined = (data: any) => {
        console.log(`NameId ${data.nameId} joined room`);
        setRemoteSocketId(data.id);
        setRemoteUser(data.nameId);
    };


    const handleCallUser = useCallback(async () => {
        const offer = await peer.getOffer();
        socket?.emit("user:call", { to: remoteSocketId, offer });
    }, [remoteSocketId, socket])


    useEffect(() => {
        // todo: done later to use peer.remotesocketid
        peer.remoteSocketId = remoteSocketId
    }, [remoteSocketId])


    const handleIncomingCall = useCallback(async (data: any) => {
        const { from, offer, nameId } = data;
        setRemoteSocketId(from);
        const ans = await peer.getAnswer(offer);
        setRemoteUser(nameId)
        // jisse call aayi usse bhej do
        socket?.emit("call:accepted", { to: from, ans });
    }, [socket])


    const handleCallAccepted = useCallback(
        (data: any) => {
            const { from, ans } = data;
            console.log(peer)
            peer.setLocalDescription(ans);
            console.log("Call Accepted!");
        },
        []
    );

    const handleNegoNeeded = useCallback(async () => {
        console.log(remoteSocketId)
        const offer = await peer.getOffer();
        // console.log(offer, remoteSocketId)
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
            console.log(remoteSocketId)
            const { from, offer } = data;
            const ans = await peer.getAnswer(offer);
            console.log(ans)
            socket?.emit("peer:nego:done", { to: from, ans });
        },
        [socket]
    );

    const handleNegoNeedFinal = useCallback(async (data: any) => {
        const { ans } = data
        console.log(ans)
        await peer.setLocalDescription(ans);
    }, []);

    useEffect(() => {
        console.log(peer.fileChannel);

    }, [peer.fileChannel]);

    const handleFileChange = (e: any) => {
        fileRef.current = e.target.files[0]
    }

    type FileMetadata = {
        name: string;
        size: number;
        type: string;
    };
    
    const chunkSize = 16 * 1024; // 16 KB chunks
    const handleSendFile = async () => {
        console.log(peer.fileChannel)
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

                for (let offset = 0; offset < arrayBuffer.byteLength; offset += chunkSize) {
                    const chunk = arrayBuffer.slice(offset, offset + chunkSize);

                    if (peer.fileChannel.readyState === 'open') {
                        console.log(chunk)
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

    const handleReceiveFile = useCallback((data: any) => {
        if (typeof data === 'string') {
            console.log("metadata")
            const metadata = JSON.parse(data);
            setReceivedChunks((prevChunks) => prevChunks ? { ...prevChunks, metadata } : { metadata, chunks: [] });
        } else if (data instanceof ArrayBuffer) {
            console.log("chunk")
            setReceivedChunks((prevChunks) => prevChunks ? { ...prevChunks, chunks: [...prevChunks.chunks, data] } : { metadata: null, chunks: [data] });
        }
    }, []);
    
    useEffect(() => {
        console.log(receivedChunks)
        if (receivedChunks && receivedChunks.metadata && receivedChunks.chunks.length === Math.ceil(receivedChunks.metadata.size / chunkSize)) {
            console.log("hello")
            const fileData = new Blob(receivedChunks.chunks, {
                type: receivedChunks.metadata.type,
            });
            const downloadLink = URL.createObjectURL(fileData);
            setDownloadLink(downloadLink);
            console.log(downloadLink);

            console.log(`Received file: ${receivedChunks.metadata.name}`);
            console.log(`Size: ${receivedChunks.metadata.size} bytes`);
            console.log(`Type: ${receivedChunks.metadata.type}`);

            const downloadButton = document.createElement('a');
            downloadButton.href = downloadLink;
            downloadButton.download = receivedChunks.metadata.name;
            downloadButton.textContent = receivedChunks.metadata.name;
            document.body.appendChild(downloadButton);
        }
    }, [receivedChunks]);

    useEffect(() => {
        console.log(peer.fileChannel?.readyState)
        if (peer.peer) {
            peer.peer.ondatachannel = (e) => {
                console.log("ondatachannel")
                //@ts-ignore
                peer.remoteDataChanel = e.channel
                //@ts-ignore
                peer.remoteDataChanel.onmessage = (e) => {
                    let data = e.data;
                    console.log(typeof data, data)
                    handleReceiveFile(data);
                }
            }
        }

        return () => {
            peer.fileChannel?.removeEventListener('message', handleReceiveFile);
        };
    }, [peer.fileChannel, peer]);


    useEffect(() => {
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
            {downloadLink && <a href={downloadLink} download="received_file">Download File</a>}
        </div>
    )
}

export default page