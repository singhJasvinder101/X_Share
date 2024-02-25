import React, { FC } from 'react'

export interface AvailableFiles {
    name: string
    size: number
    blob?: Blob
    recievedSize?: number
    checksum?: string | null
    checksumMatched?: boolean
}

interface FilesSectionProps {
    file: AvailableFiles
}

const FilesSection: FC<FilesSectionProps> = ({ file }) => {
    return (
        <div>

        </div>
    )
}

export default FilesSection
