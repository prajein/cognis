import type { ActivationProfile } from "../../../../core/types";

interface BrainMapProps {
    profile?: ActivationProfile;
    isStreaming?: boolean;
}

export function BrainMap({
    profile,
    isStreaming
}: BrainMapProps) {
    if (!profile) {
        return (
            <section>
                Select a task.
            </section>
        );
    }
    
    // We'll use inline styles for the pulsing effect for now
    const streamingStyle: React.CSSProperties = isStreaming 
        ? {
            animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            borderColor: '#3b82f6', // blue-500
            borderWidth: '2px',
            borderStyle: 'solid',
            borderRadius: '8px',
            padding: '8px'
        } : {
            borderWidth: '2px',
            borderColor: 'transparent',
            borderStyle: 'solid',
            borderRadius: '8px',
            padding: '8px'
        };

    return (
        <section style={{ 
            ...streamingStyle, 
            transition: 'border-color 0.3s ease' 
        }}>
            <h2>{profile.display_name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {Object.entries(profile.region_profile).map(
                    ([region, value]) => (
                        <div key={region} style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                            <div style={{ width: '80px', fontWeight: 'bold' }}>{region}</div>
                            <div style={{ flex: 1, backgroundColor: '#e5e7eb', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ 
                                    width: `${(value / 5) * 100}%`, 
                                    backgroundColor: '#3b82f6', 
                                    height: '100%',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                            <div style={{ width: '20px', textAlign: 'right' }}>{value}</div>
                        </div>
                    )
                )}
            </div>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }
            `}</style>
        </section>
    );
}