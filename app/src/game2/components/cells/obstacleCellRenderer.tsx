import { Cell } from '../../logic/cellTypes';

export const ObstacleCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64,
        height: 64,
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderTop: '2.5px solid rgba(255,255,255,0.15)',
        borderLeft: '2.5px solid rgba(255,255,255,0.12)',
        borderRight: '2.5px solid rgba(0,0,0,0.4)',
        borderBottom: '2.5px solid rgba(0,0,0,0.5)',
        borderRadius: '6px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 0 8px rgba(0,0,0,0.6)',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }}>
        {/* Inner panel representing a tech-plate */}
        <div style={{
            width: '75%',
            height: '75%',
            background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
            border: '1.5px solid rgba(0,0,0,0.45)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.4)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {/* Minimalist modern core mark */}
            <div style={{
                width: '35%',
                height: '35%',
                border: '2px solid #64748b',
                borderRadius: '2px',
                transform: 'rotate(45deg)',
                boxShadow: '0 0 4px rgba(100,116,139,0.3)'
            }} />
        </div>
    </div>
);
