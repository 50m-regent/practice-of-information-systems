export type Difficulty = number;

export type MusicID = number;

export type UserProficiency = number;

export type MusicXML = string;
export type Sheet = MusicXML;

export enum Genre{
    JPOP = "J-POP",
    KPOP = "K-POP",
    CLASSIC = "CLASSIC",
    ROCK = "ROCK",
    HIPHOP = "HIPHOP",
    JAZZ = "JAZZ",
    BLUES = "BLUES",
    REGGAE = "REGGAE",
    FUNK = "FUNK",
    DISCO = "DISCO",
    METAL = "METAL",
    PUNK = "PUNK",
    FOLK = "FOLK",
    COUNTRY = "COUNTRY",
    ELECTRONIC = "ELECTRONIC",
}

export type MusicSegment = {
    measure : number;
}

export type AudioClip = {
    Clip : number[];
    mmusicSegment : MusicSegment;

}

export type DysplayMusic ={
    music_id : MusicID;
    title : string;
    artist : string;
    thumbnail : string;//Base64形式の画像データ
}
export enum SearchCategory {
    Difficulty = "DiffSearch",
    Title = "KeywordSearch",
    Artist = "artist",
    Genre = "GenreSearch",
}

export type SearchQuery = Difficulty | string | Genre;
