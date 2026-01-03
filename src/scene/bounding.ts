import type { Matrix } from "../geo/matrix";
import type { Vector } from "../geo/vector";
import { Vector3, Vertex } from "../geo/vector";

type Plane = { normal: Vector; pointIndex: number };

type Cuboid = [Vertex, Vertex, Vertex, Vertex, Vertex, Vertex, Vertex, Vertex];
type CuboidPlanes = [Plane, Plane, Plane, Plane, Plane, Plane];

// TODO post-mvp: perf - flat boundings
export class Bounding {
    // We need all 8 corners to preserve  all min's and max'es pre-rotation
    cuboid: Cuboid;

    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;

    planes: CuboidPlanes;

    // TODO mvp: handle empty array
    constructor(vertices: Vertex[]) {
        if (vertices.length === 0) {
            vertices = [new Vertex(0, 0, 0)];
        }

        this.minX = Math.min(...vertices.map(v => v.x));
        this.minY = Math.min(...vertices.map(v => v.y));
        this.minZ = Math.min(...vertices.map(v => v.z));
        this.maxX = Math.max(...vertices.map(v => v.x));
        this.maxY = Math.max(...vertices.map(v => v.y));
        this.maxZ = Math.max(...vertices.map(v => v.z));

        /**
         *   2--------6
         *  /|       /|
         * 3--------7 |
         * | |      | |
         * | 0------|-4
         * |/       |/
         * 1--------5
         */
        this.cuboid = [this.minX, this.maxX]
            .map(x =>
                [this.minY, this.maxY].map(y =>
                    [this.minZ, this.maxZ].map(z => new Vertex(x, y, z))
                )
            )
            .flat(2) as Cuboid;

        this.planes = [
            {
                normal: new Vector3(0, 0, -1),
                pointIndex: 0,
            },
            {
                normal: new Vector3(0, 0, 1),
                pointIndex: 7,
            },
            {
                normal: new Vector3(0, -1, 0),
                pointIndex: 0,
            },
            {
                normal: new Vector3(0, 1, 0),
                pointIndex: 7,
            },
            {
                normal: new Vector3(-1, 0, 0),
                pointIndex: 0,
            },
            {
                normal: new Vector3(1, 0, 0),
                pointIndex: 7,
            },
        ];
    }

    transform(pointMatrix: Matrix, normalMatrix: Matrix) {
        const bounding = new Bounding([]);

        bounding.cuboid = this.cuboid.map(p =>
            p.transform(pointMatrix)
        ) as Cuboid;

        bounding.planes = this.planes.map(p => ({
            normal: p.normal.transform(normalMatrix),
            pointIndex: p.pointIndex,
        })) as CuboidPlanes;

        bounding.minX = Math.min(...bounding.cuboid.map(v => v.x));
        bounding.minY = Math.min(...bounding.cuboid.map(v => v.y));
        bounding.minZ = Math.min(...bounding.cuboid.map(v => v.z));
        bounding.maxX = Math.max(...bounding.cuboid.map(v => v.x));
        bounding.maxY = Math.max(...bounding.cuboid.map(v => v.y));
        bounding.maxZ = Math.max(...bounding.cuboid.map(v => v.z));

        return bounding;
    }
}
