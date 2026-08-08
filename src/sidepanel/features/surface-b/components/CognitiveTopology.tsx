interface CognitiveTopologyProps {
    isStreaming: boolean;
    isActive: boolean;
}

export function CognitiveTopology({ isStreaming, isActive }: CognitiveTopologyProps) {
    let stateAttr = 'idle';
    if (isStreaming) {
        stateAttr = 'processing';
    } else if (isActive) {
        stateAttr = 'active';
    }

    return (
        <div className="topology-container" data-state={stateAttr}>
            <svg width="120" height="80" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
                {/* Links */}
                <line x1="20" y1="20" x2="60" y2="60" className="topology-link" />
                <line x1="100" y1="20" x2="60" y2="60" className="topology-link" />
                <line x1="20" y1="20" x2="100" y2="20" className="topology-link" />
                
                {/* Nodes */}
                <circle cx="20" cy="20" r="6" className="topology-node" />
                <circle cx="100" cy="20" r="6" className="topology-node" />
                <circle cx="60" cy="60" r="6" className="topology-node" />
            </svg>
        </div>
    );
}
