#![no_std]

use add::add;
use vector_types::{Vector2, Vector3, Vector4};

pub fn add_vector_2d(v1: Vector2, v2: Vector2) -> Vector2 {
    Vector2 {
        x: add(v1.x, v2.x),
        y: add(v1.y, v2.y),
    }
}

pub fn add_vector_3d(v1: Vector3, v2: Vector3) -> Vector3 {
    Vector3 {
        x: add(v1.x, v2.x),
        y: add(v1.y, v2.y),
        z: add(v1.z, v2.z),
    }
}

pub fn add_vector_4d(v1: Vector4, v2: Vector4) -> Vector4 {
    Vector4 {
        x: add(v1.x, v2.x),
        y: add(v1.y, v2.y),
        z: add(v1.z, v2.z),
        w: add(v1.w, v2.w),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_vector_2d() {
        assert_eq!(
            add_vector_2d(Vector2::new(2.0, 3.0), Vector2::new(4.0, 5.0)),
            Vector2::new(6.0, 8.0)
        );
    }

    #[test]
    fn test_add_vector_3d() {
        assert_eq!(
            add_vector_3d(Vector3::new(2.0, 3.0, 4.0), Vector3::new(5.0, 6.0, 7.0)),
            Vector3::new(7.0, 9.0, 11.0)
        );
    }

    #[test]
    fn test_add_vector_4d() {
        assert_eq!(
            add_vector_4d(
                Vector4::new(2.0, 3.0, 4.0, 5.0),
                Vector4::new(6.0, 7.0, 8.0, 9.0)
            ),
            Vector4::new(8.0, 10.0, 12.0, 14.0)
        );
    }
}
