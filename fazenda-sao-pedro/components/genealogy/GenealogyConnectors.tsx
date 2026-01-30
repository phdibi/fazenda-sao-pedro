import React from 'react';
import { ShareIcon } from '../common/Icons';

interface ConnectorProps {
    visible?: boolean;
}

export const VerticalConnector = ({ visible = true }: ConnectorProps) => (
    <div className={`w-px h-3 ${visible ? 'bg-base-600' : 'bg-transparent'}`} />
);

export const HorizontalConnector = () => (
    <div className="flex items-center justify-center w-full">
        <div className="flex-1 h-px bg-base-600" />
        <ShareIcon className="w-3 h-3 text-base-600 rotate-90 mx-1" />
        <div className="flex-1 h-px bg-base-600" />
    </div>
);
