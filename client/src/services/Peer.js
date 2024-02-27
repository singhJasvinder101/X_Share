class PeerService {
    remoteSocketId = null;
    constructor() {
        if (!this.peer) {
            this.peer = new RTCPeerConnection({
                iceServers: [
                    {
                        urls: [
                            "stun:stun4.l.google.com:19302",
                        ],
                    },
                ],
            });
            this.fileChannel = this.peer?.createDataChannel(
                `file-transfer-${Date.now()}`
            )
        }
    }


    async getAnswer(offer) {
        if (this.peer) {
            console.log(offer)
            await this.peer.setRemoteDescription(offer);
            const ans = await this.peer.createAnswer();
            await this.peer.setLocalDescription(new RTCSessionDescription(ans));
            return ans;
        }
    }

    async setLocalDescription(ans) {
        if (this.peer) {
            await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
        }
    }

    async getOffer() {
        if (this.peer) {
            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(new RTCSessionDescription(offer));
            return offer;
        }
    }
}

export default new PeerService();
