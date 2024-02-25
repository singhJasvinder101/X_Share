"use client"

import { FC, ReactNode, createContext, useCallback, useContext, useMemo } from "react"

interface RTCPeerConnectionTypes {
    peer: RTCPeerConnection | null;
    createOffer: () => Promise<RTCSessionDescriptionInit | null>;
    createAnswer: (offer: any) => Promise<RTCSessionDescriptionInit | null>;
    setRemoteAns: (ans: RTCSessionDescriptionInit) => void;
}

const WebRTCContext = createContext<RTCPeerConnectionTypes | null>(null)

export const WebRTCProvider: FC<{ children: ReactNode }> = ({ children }) => {

    const peer = useMemo(() => {
        if (typeof window !== 'undefined' && window.RTCPeerConnection) {
            return new RTCPeerConnection({
                iceServers: [
                    {
                        urls: [
                            "stun:stun.l.google.com:19302",
                            "stun:global.stun.twilio.com:3478"
                        ]
                    }
                ]
            })
        } else {
            return null
        }
    }, [])

    const createOffer = useMemo(
        () =>
            async () => {
                if (peer) {
                    try {
                        const offer = await peer.createOffer();
                        await peer.setLocalDescription(offer);
                        return offer;
                    } catch (error) {
                        console.error("Error creating offer:", error);
                        return null;
                    }
                } else {
                    return null;
                }
            }, [peer]
    );

    const createAnswer = useMemo(() => async (offer: any) => {
        if (peer) {
            try {
                await peer.setRemoteDescription(offer);
                // This step informs Peer B about the media capabilities and preferences of Peer A.
                const answer = await peer.createAnswer();
                // Peer B creates an answer based on its own media capabilities and preferences and set in localdescription
                await peer.setLocalDescription(answer);
                return answer;
            } catch (error) {
                console.error("Error creating answer:", error);
                return null;
            }
        } else {
            return null;
        }
    }, [peer])

    const setRemoteAns = useCallback((data: any) => {
        if (peer) {
            peer.setRemoteDescription(data)
        }
    }, [])

    return (
        <WebRTCContext.Provider value={{
            peer,
            createOffer,
            createAnswer,
            setRemoteAns
        }}>
            {children}
        </WebRTCContext.Provider>
    )
}


export const useWebRTC = () => {
    const socket = useContext(WebRTCContext)
    return socket
}