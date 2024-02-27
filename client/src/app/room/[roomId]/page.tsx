"use client"
import { useWebRTC } from '@/Context/RTCProvider'
import { useSocket } from '@/Context/SocketProvider'
import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import peer from '@/services/peer'


const page = () => {
    const socket = useSocket()
    const fileRef = useRef<File | null>(null);
    const [remoteSocketId, setRemoteSocketId] = useState(null);
    const [remoteUser, setRemoteUser] = useState<string | null>()
    const [downloadLink, setDownloadLink] = useState<string | null>(null);
    const [receivedChunks, setReceivedChunks] = useState<{ metadata: FileMetadata | null; chunks: ArrayBuffer[] } | null>(null);
    const ref = useRef<HTMLInputElement>(null);
    const [buttonMessage, setButtonMessage] = useState<string>("Call")
    const [isDisabled, setIsDisabled] = useState<boolean>(false)
    const [isUploaded, setIsUploaded] = useState<boolean>(false)

    const handleRoomJoined = (data: any) => {
        // console.log(`NameId ${data.nameId} joined room`);
        setRemoteSocketId(data.id);
        setRemoteUser(data.nameId);
    };


    const handleCallUser = useCallback(async () => {
        const offer = await peer.getOffer();
        socket?.emit("user:call", { to: remoteSocketId, offer });
        setButtonMessage("Call Sent!! Yupp")
        setIsDisabled(true);
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
        setButtonMessage("Accept Call")
        // jisse call aayi usse bhej do
        socket?.emit("call:accepted", { to: from, ans });
    }, [socket])


    const handleCallAccepted = useCallback(
        (data: any) => {
            const { from, ans } = data;
            peer.setLocalDescription(ans);
            console.log("Call Accepted!");
            setIsDisabled(true)
        },
        []
    );

    const handleNegoNeeded = useCallback(async () => {
        const offer = await peer.getOffer();
        socket?.emit("peer:nego:needed", { offer, to: remoteSocketId });
    }, [remoteSocketId, socket]);

    useEffect(() => {
        // @ts-ignore
        peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
        return () => {
            // @ts-ignore
            peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
        };
    }, [handleNegoNeeded]);

    const handleNegoNeedIncomming = useCallback(
        async (data: any) => {
            const { from, offer } = data;
            const ans = await peer.getAnswer(offer);
            socket?.emit("peer:nego:done", { to: from, ans });

        },
        [socket]
    );

    const handleNegoNeedFinal = useCallback(async (data: any) => {
        const { ans } = data
        await peer.setLocalDescription(ans);
    }, []);

    useEffect(() => {
        console.log(peer.fileChannel);

    }, [peer.fileChannel]);

    const handleFileChange = (e: any) => {
        fileRef.current = e.target.files[0]
        setIsUploaded(true)
    }

    const handleRefClick = () => {
        if (ref.current) {
            ref.current.click();
        }
    }


    type FileMetadata = {
        name: string;
        size: number;
        type: string;
    };

    const chunkSize = 16 * 1024; // 16 KB chunks
    const handleSendFile = async () => {
        if (fileRef.current && peer.fileChannel) {
            const file: File = fileRef.current;

            // Reading the entire file as an ArrayBuffer
            const arrayBuffer: ArrayBuffer = await readFileAsArrayBuffer(file);
            const metadata: FileMetadata = {
                name: file.name,
                size: file.size,
                type: file.type,
            };

            if (peer.fileChannel.readyState === 'open') {
                peer.fileChannel.send(JSON.stringify(metadata));

                for (let offset = 0; offset < arrayBuffer.byteLength; offset += chunkSize) {
                    const chunk = arrayBuffer.slice(offset, offset + chunkSize);
                    peer.fileChannel.send(chunk);
                }

            } else {
                console.log('RTCDataChannel not in open state');
            }
        } else {
            return
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
            const metadata = JSON.parse(data);
            setReceivedChunks((prevChunks) => prevChunks ? { ...prevChunks, metadata } : { metadata, chunks: [] });
        } else if (data instanceof ArrayBuffer) {
            setReceivedChunks((prevChunks) => prevChunks ? { ...prevChunks, chunks: [...prevChunks.chunks, data] } : { metadata: null, chunks: [data] });
        }
    }, []);

    useEffect(() => {
        if (receivedChunks && receivedChunks.metadata && receivedChunks.chunks.length === Math.ceil(receivedChunks.metadata.size / chunkSize)) {
            const fileData = new Blob(receivedChunks.chunks, {
                type: receivedChunks.metadata.type,
            });
            const downloadLink = URL.createObjectURL(fileData);
            setDownloadLink(downloadLink);

            // console.log(`Received file: ${receivedChunks.metadata.name}`);
            // console.log(`Size: ${receivedChunks.metadata.size} bytes`);
            // console.log(`Type: ${receivedChunks.metadata.type}`);
        }
    }, [receivedChunks]);

    useEffect(() => {
        if (peer.peer) {
            peer.peer.ondatachannel = (e) => {
                //@ts-ignore
                peer.remoteDataChanel = e.channel
                //@ts-ignore
                peer.remoteDataChanel.onmessage = (e) => {
                    let data = e.data;
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
        <main>
            <div className="form">
                <h1 className='text-3xl font-bold'>Room Page</h1>
                <div className="form-content">
                    <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
                    <h4>connection with {remoteUser}</h4>
                    <input className='file' ref={ref} type="file" onChange={handleFileChange} />
                    <div onClick={handleRefClick} className="input-file"> Input File</div>
                    {isUploaded && <h4 className='text-sm text-purple-700'>File Uploaded !!!</h4>}
                    <button className='btn' onClick={handleSendFile}>Send File</button>
                    {remoteSocketId && <button disabled={isDisabled} className={`btn ${isDisabled ? 'disabled:cursor-not-allowed' : ''}`} onClick={handleCallUser}>{buttonMessage}</button>}
                    {downloadLink && <a className='btn' href={downloadLink} download={receivedChunks?.metadata?.name}>Download File</a>}
                </div>
            </div>
        </main>
    )
}

export default page